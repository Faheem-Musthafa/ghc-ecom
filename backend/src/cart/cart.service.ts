import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CartStatus, Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SetCartItemDto } from './dto/set-cart-item.dto';

const cartInclude = {
  items: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      variant: {
        include: {
          images: {
            orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
            take: 1,
          },
          product: {
            include: {
              category: {
                select: { name: true },
              },
              images: {
                where: { variantId: null },
                orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
                take: 1,
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

export interface CartView {
  id: string;
  status: CartStatus;
  expiresAt: Date;
  items: Array<{
    id: string;
    variantId: string;
    sku: string;
    productName: string;
    variantName: string;
    imageUrl: string | null;
    quantity: number;
    unitPricePaise: number;
    lineTotalPaise: number;
  }>;
  subtotalPaise: number;
}

export interface CreatedCart {
  cart: CartView;
  guestToken?: string;
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async createCart(authorization?: string): Promise<CreatedCart> {
    const userId = await this.optionalUserId(authorization);
    if (userId) {
      const existing = await this.prisma.cart.findFirst({
        where: {
          userId,
          status: CartStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
        include: cartInclude,
      });
      if (existing) {
        return { cart: this.view(existing) };
      }
      const cart = await this.prisma.cart.create({
        data: {
          userId,
          expiresAt: this.cartExpiry(),
        },
        include: cartInclude,
      });
      return { cart: this.view(cart) };
    }

    const guestToken = randomBytes(32).toString('base64url');
    const cart = await this.prisma.cart.create({
      data: {
        guestTokenHash: this.hashToken(guestToken),
        expiresAt: this.cartExpiry(),
      },
      include: cartInclude,
    });
    return { cart: this.view(cart), guestToken };
  }

  async getCart(cartId: string, authorization?: string, guestToken?: string): Promise<CartView> {
    return this.view(await this.requireAccessibleCart(cartId, authorization, guestToken));
  }

  async setItem(
    cartId: string,
    input: SetCartItemDto,
    authorization?: string,
    guestToken?: string,
  ): Promise<CartView> {
    const cart = await this.requireAccessibleCart(cartId, authorization, guestToken);
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: input.variantId,
        isActive: true,
        product: {
          status: ProductStatus.PUBLISHED,
          publishedAt: { lte: new Date() },
          category: { isPublished: true },
        },
      },
    });
    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`select public.release_cart_reservations(${cart.id}::uuid)`;
      await transaction.checkoutQuote.updateMany({
        where: { cartId: cart.id, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });
      const inventoryLevels = await transaction.inventoryLevel.findMany({
        where: {
          variantId: input.variantId,
          warehouse: { isActive: true },
        },
        select: { onHand: true, reserved: true },
      });
      const availableStock = Math.max(
        0,
        ...inventoryLevels.map((level) => Math.max(0, level.onHand - level.reserved)),
      );
      if (input.quantity > availableStock) {
        throw new ConflictException(
          availableStock === 0
            ? 'This product is currently out of stock.'
            : `Only ${availableStock} item${availableStock === 1 ? '' : 's'} are currently available.`,
        );
      }
      await transaction.cartItem.upsert({
        where: { cartId_variantId: { cartId: cart.id, variantId: input.variantId } },
        create: { cartId: cart.id, variantId: input.variantId, quantity: input.quantity },
        update: { quantity: input.quantity },
      });
    });
    return this.getCart(cartId, authorization, guestToken);
  }

  async removeItem(
    cartId: string,
    variantId: string,
    authorization?: string,
    guestToken?: string,
  ): Promise<CartView> {
    const cart = await this.requireAccessibleCart(cartId, authorization, guestToken);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`select public.release_cart_reservations(${cart.id}::uuid)`;
      await transaction.checkoutQuote.updateMany({
        where: { cartId: cart.id, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });
      const result = await transaction.cartItem.deleteMany({
        where: { cartId: cart.id, variantId },
      });
      if (result.count !== 1) {
        throw new NotFoundException('Cart item not found');
      }
    });
    return this.getCart(cartId, authorization, guestToken);
  }

  async requireAccessibleCart(
    cartId: string,
    authorization?: string,
    guestToken?: string,
  ): Promise<CartWithItems> {
    return this.requireOwnedCart(cartId, authorization, guestToken, true);
  }

  async requireOwnedCart(
    cartId: string,
    authorization?: string,
    guestToken?: string,
    requireActive = false,
  ): Promise<CartWithItems> {
    const userId = await this.optionalUserId(authorization);
    let ownerWhere: Prisma.CartWhereInput;
    if (userId) {
      ownerWhere = { userId };
    } else {
      if (!guestToken) throw new UnauthorizedException('Cart access denied');
      ownerWhere = { guestTokenHash: this.hashToken(guestToken) };
    }
    const cart = await this.prisma.cart.findFirst({
      where: {
        id: cartId,
        ...(requireActive ? { status: CartStatus.ACTIVE, expiresAt: { gt: new Date() } } : {}),
        ...ownerWhere,
      },
      include: cartInclude,
    });
    if (!cart) {
      throw new UnauthorizedException('Cart access denied');
    }
    return cart;
  }

  view(cart: CartWithItems): CartView {
    const items = cart.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      sku: item.variant.sku,
      productName: item.variant.product.name,
      variantName: item.variant.name,
      imageUrl:
        item.variant.images[0]?.thumbnailUrl ??
        item.variant.product.images[0]?.thumbnailUrl ??
        null,
      quantity: item.quantity,
      unitPricePaise: item.variant.pricePaise,
      lineTotalPaise: item.variant.pricePaise * item.quantity,
    }));
    return {
      id: cart.id,
      status: cart.status,
      expiresAt: cart.expiresAt,
      items,
      subtotalPaise: items.reduce((sum, item) => sum + item.lineTotalPaise, 0),
    };
  }

  private async optionalUserId(authorization?: string): Promise<string | undefined> {
    if (!authorization) {
      return undefined;
    }
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match?.[1]) {
      throw new UnauthorizedException('Invalid authorization header');
    }
    return (await this.supabase.verifyAccessToken(match[1])).id;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private cartExpiry(): Date {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
}
