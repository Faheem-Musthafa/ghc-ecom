import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CheckoutQuote, Coupon, DiscountType, OrderStatus, Prisma, QuoteStatus } from '@prisma/client';
import { CartService, CartWithItems } from '../cart/cart.service';
import { PrismaService } from '../database/prisma.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ShippingAddressDto } from './dto/shipping-address.dto';

const QUOTE_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carts: CartService,
  ) {}

  async createQuote(
    input: CreateQuoteDto,
    authorization?: string,
    guestToken?: string,
  ): Promise<CheckoutQuote> {
    const cart = await this.carts.requireAccessibleCart(input.cartId, authorization, guestToken);
    if (cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const addressSnapshot = await this.addressSnapshot(cart, input);
    const subtotalPaise = cart.items.reduce(
      (sum, item) => sum + item.variant.pricePaise * item.quantity,
      0,
    );
    const coupon = input.couponCode
      ? await this.validateCoupon(input.couponCode, subtotalPaise, cart.userId)
      : null;
    const discountPaise = this.discount(coupon, subtotalPaise);
    const taxablePaise = subtotalPaise - discountPaise;
    // Published catalogue prices are the final customer prices. This store does not offer delivery.
    const shippingPaise = 0;
    const taxPaise = 0;
    const totalPaise = taxablePaise + shippingPaise + taxPaise;
    const expiresAt = new Date(Date.now() + QUOTE_TTL_MS);
    const itemsSnapshot = this.itemsSnapshot(cart);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`select pg_advisory_xact_lock(
          hashtextextended(${cart.id}::text, 0)
        )`;
        const pending = await transaction.order.findFirst({
          where: {
            cartId: cart.id,
            status: OrderStatus.PAYMENT_PENDING,
            paymentExpiresAt: { gt: new Date() },
            quote: { status: QuoteStatus.ACTIVE, expiresAt: { gt: new Date() } },
          },
          include: { quote: true },
          orderBy: { createdAt: 'desc' },
        });
        if (pending) return pending.quote;
        await transaction.checkoutQuote.updateMany({
          where: { cartId: cart.id, status: QuoteStatus.ACTIVE },
          data: { status: QuoteStatus.EXPIRED },
        });
        await transaction.$executeRaw`select public.reserve_cart_inventory(
          ${cart.id}::uuid,
          ${expiresAt}::timestamptz
        )`;
        return transaction.checkoutQuote.create({
          data: {
            cartId: cart.id,
            userId: cart.userId,
            couponId: coupon?.id,
            itemsSnapshot,
            addressSnapshot,
            subtotalPaise,
            discountPaise,
            shippingPaise,
            taxPaise,
            totalPaise,
            expiresAt,
          },
        });
      });
    } catch (error) {
      if (error instanceof Error && /insufficient inventory|cart is empty/i.test(error.message)) {
        throw new ConflictException('Requested inventory is unavailable');
      }
      throw error;
    }
  }

  private async addressSnapshot(
    cart: CartWithItems,
    input: CreateQuoteDto,
  ): Promise<Prisma.InputJsonObject> {
    if (cart.userId) {
      if (!input.addressId || input.shippingAddress) {
        throw new BadRequestException('Authenticated checkout requires addressId only');
      }
      const address = await this.prisma.address.findFirst({
        where: { id: input.addressId, userId: cart.userId },
      });
      if (!address) {
        throw new NotFoundException('Address not found');
      }
      return {
        email: input.contactEmail.toLowerCase(),
        recipientName: address.recipientName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2 ?? '',
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      };
    }
    if (!input.shippingAddress || input.addressId) {
      throw new BadRequestException('Guest checkout requires shippingAddress only');
    }
    return {
      ...this.guestAddress(input.shippingAddress),
      email: input.contactEmail.toLowerCase(),
    };
  }

  private guestAddress(address: ShippingAddressDto): Prisma.InputJsonObject {
    return {
      recipientName: address.recipientName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country.toUpperCase(),
    };
  }

  private itemsSnapshot(cart: CartWithItems): Prisma.InputJsonArray {
    return cart.items.map((item) => ({
      variantId: item.variantId,
      sku: item.variant.sku,
      barcode: item.variant.barcode,
      productName: item.variant.product.name,
      productSlug: item.variant.product.slug,
      categoryName: item.variant.product.category?.name ?? null,
      productDescription:
        item.variant.product.shortDescription ?? item.variant.product.description ?? null,
      productMaterial: item.variant.product.material ?? null,
      color: this.variantColor(item.variant.attributes),
      imageUrl:
        item.variant.images?.[0]?.thumbnailUrl ??
        item.variant.product.images?.[0]?.thumbnailUrl ??
        null,
      quantity: item.quantity,
      unitPricePaise: item.variant.pricePaise,
      lineTotalPaise: item.variant.pricePaise * item.quantity,
      attributes: item.variant.attributes,
    })) as Prisma.InputJsonArray;
  }

  private variantColor(attributes: Prisma.JsonValue): string | null {
    if (!attributes || Array.isArray(attributes) || typeof attributes !== 'object') return null;
    const color = (attributes as Prisma.JsonObject).color;
    return typeof color === 'string' && color.trim() ? color.trim() : null;
  }

  private async validateCoupon(
    code: string,
    subtotalPaise: number,
    userId: string | null,
  ): Promise<Coupon> {
    const now = new Date();
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
    });
    if (!coupon || subtotalPaise < coupon.minimumSubtotalPaise) {
      throw new BadRequestException('Coupon is invalid or ineligible');
    }
    const totalUses = await this.prisma.couponRedemption.count({
      where: { couponId: coupon.id },
    });
    if (coupon.usageLimit !== null && totalUses >= coupon.usageLimit) {
      throw new BadRequestException('Coupon redemption limit reached');
    }
    if (coupon.perUserLimit !== null) {
      if (!userId) {
        throw new BadRequestException('This coupon requires an authenticated customer');
      }
      const userUses = await this.prisma.couponRedemption.count({
        where: { couponId: coupon.id, userId },
      });
      if (userUses >= coupon.perUserLimit) {
        throw new BadRequestException('Customer coupon redemption limit reached');
      }
    }
    return coupon;
  }

  private discount(coupon: Coupon | null, subtotalPaise: number): number {
    if (!coupon) {
      return 0;
    }
    const calculated =
      coupon.type === DiscountType.PERCENT
        ? Math.floor((subtotalPaise * coupon.value) / 10_000)
        : Math.min(coupon.value, subtotalPaise);
    return Math.min(calculated, coupon.maximumDiscountPaise ?? calculated, subtotalPaise);
  }
}
