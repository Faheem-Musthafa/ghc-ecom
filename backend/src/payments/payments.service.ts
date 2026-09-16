import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Order, OrderStatus, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { CartService } from '../cart/cart.service';
import { PrismaService } from '../database/prisma.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { orderCreateData, requireActiveQuote, toInputJson } from './order-factory';
import { VerifyRazorpayPaymentDto } from './dto/verify-razorpay-payment.dto';
import { RazorpayOrder, RazorpayPayment, RazorpayService } from './razorpay.service';

export interface PaymentIntent {
  keyId: string;
  razorpayOrderId: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  checkout: {
    items: Prisma.JsonValue;
    shippingAddress: Prisma.JsonValue;
  };
}

export interface ReconciliationResult {
  inspected: number;
  confirmed: number;
  failed: number;
  pending: number;
  errors: number;
}

const PROVIDER_ORDER_CLAIM_MS = 2 * 60 * 1000;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carts: CartService,
    private readonly razorpay: RazorpayService,
  ) {}

  async createIntent(
    input: CreatePaymentIntentDto,
    authorization?: string,
    guestToken?: string,
  ): Promise<PaymentIntent> {
    const quote = await this.prisma.checkoutQuote.findUnique({ where: { id: input.quoteId } });
    if (!quote) {
      throw new NotFoundException('Checkout quote not found');
    }
    await this.carts.requireAccessibleCart(quote.cartId, authorization, guestToken);
    requireActiveQuote(quote);

    const claimed = await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`select pg_advisory_xact_lock(
          hashtextextended(${quote.id}::text, 0)
        )`;
      const existing = await transaction.order.findUnique({ where: { quoteId: quote.id } });
      if (existing?.razorpayOrderId) {
        return { order: existing, acquired: false, recovery: false };
      }
      if (existing && existing.paymentProvider !== PaymentProvider.RAZORPAY) {
        throw new ConflictException('Order is already assigned to another payment gateway');
      }
      const claimTime = new Date();
      if (!existing) {
        const order = await transaction.order.create({
          data: {
            ...orderCreateData(quote, PaymentProvider.RAZORPAY),
            providerOrderClaimedAt: claimTime,
          },
        });
        return { order, acquired: true, recovery: false };
      }
      const claim = await transaction.order.updateMany({
        where: {
          id: existing.id,
          razorpayOrderId: null,
          OR: [
            { providerOrderClaimedAt: null },
            {
              providerOrderClaimedAt: {
                lte: new Date(Date.now() - PROVIDER_ORDER_CLAIM_MS),
              },
            },
          ],
        },
        data: { providerOrderClaimedAt: claimTime },
      });
      return {
        order: { ...existing, providerOrderClaimedAt: claimTime },
        acquired: claim.count === 1,
        recovery: claim.count === 1 && existing.providerOrderClaimedAt !== null,
      };
    });

    if (claimed.order.razorpayOrderId) return this.intentView(claimed.order);
    if (!claimed.acquired) {
      throw new ConflictException('Payment setup is already in progress; retry shortly');
    }

    const receipt = claimed.order.orderNumber.slice(0, 40);
    const recoveredOrder = claimed.recovery
      ? await this.razorpay.findOrderByReceipt(receipt, claimed.order.createdAt)
      : null;
    const providerOrder =
      recoveredOrder ??
      (await this.razorpay.createOrder({
        amount: claimed.order.totalPaise,
        currency: claimed.order.currency,
        receipt,
        notes: { local_order_id: claimed.order.id },
      }));
    this.assertMatchingOrder(claimed.order, providerOrder);
    await this.prisma.order.updateMany({
      where: {
        id: claimed.order.id,
        paymentProvider: PaymentProvider.RAZORPAY,
        razorpayOrderId: null,
      },
      data: { razorpayOrderId: providerOrder.id, providerOrderClaimedAt: null },
    });
    const order = await this.prisma.order.findUnique({ where: { id: claimed.order.id } });
    if (!order?.razorpayOrderId) {
      throw new ConflictException('Payment setup could not be saved; retry shortly');
    }
    return this.intentView(order);
  }

  async verifyCheckout(
    input: VerifyRazorpayPaymentDto,
    authorization?: string,
    guestToken?: string,
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { razorpayOrderId: input.razorpayOrderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    await this.carts.requireOwnedCart(order.cartId, authorization, guestToken);
    if (
      !this.razorpay.verifyCheckoutSignature(
        order.razorpayOrderId!,
        input.razorpayPaymentId,
        input.razorpaySignature,
      )
    ) {
      throw new UnauthorizedException('Invalid Razorpay payment signature');
    }
    const payment = await this.razorpay.fetchPayment(input.razorpayPaymentId);
    await this.applyCapturedPayment(order, payment, true);
    return (await this.prisma.order.findUnique({ where: { id: order.id } })) ?? order;
  }

  async resolveCheckoutStatus(
    razorpayOrderId: string,
    authorization?: string,
    guestToken?: string,
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { razorpayOrderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    await this.carts.requireOwnedCart(order.cartId, authorization, guestToken);
    if (order.status !== OrderStatus.PAYMENT_PENDING) {
      return order;
    }

    const providerOrder = await this.razorpay.fetchOrder(razorpayOrderId);
    if (providerOrder.status === 'paid') {
      const payments = await this.razorpay.fetchPaymentsForOrder(razorpayOrderId);
      const captured = payments.find((payment) => payment.status === 'captured');
      if (captured) {
        await this.applyCapturedPayment(order, captured);
      }
    } else if (order.paymentExpiresAt <= new Date()) {
      await this.prisma.$executeRaw`select public.fail_pending_order(${order.id}::uuid)`;
    }

    return (await this.prisma.order.findUnique({ where: { id: order.id } })) ?? order;
  }

  async applyCapturedPayment(
    order: Order,
    payment: RazorpayPayment,
    signatureVerified = false,
  ): Promise<void> {
    this.assertCapturedPayment(order, payment);
    await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.payment.findUnique({
        where: { razorpayPaymentId: payment.id },
        select: { orderId: true },
      });
      if (existing && existing.orderId !== order.id) {
        throw new ConflictException('Razorpay payment is already linked to another order');
      }
      await transaction.payment.upsert({
        where: { razorpayPaymentId: payment.id },
        create: {
          orderId: order.id,
          razorpayPaymentId: payment.id,
          status: PaymentStatus.CAPTURED,
          amountPaise: payment.amount,
          currency: payment.currency,
          signatureVerified,
          method: payment.method,
          capturedAt: this.providerDate(payment.created_at),
          rawPayload: this.json(payment),
        },
        update: {
          status: PaymentStatus.CAPTURED,
          signatureVerified: signatureVerified ? true : undefined,
          method: payment.method,
          capturedAt: this.providerDate(payment.created_at),
          rawPayload: this.json(payment),
        },
      });
      await transaction.$executeRaw`select public.confirm_paid_order(${order.id}::uuid)`;
    });
  }

  async applyFailedPayment(order: Order, payment: RazorpayPayment): Promise<void> {
    if (
      payment.order_id !== order.razorpayOrderId ||
      payment.amount !== order.totalPaise ||
      payment.currency !== order.currency
    ) {
      throw new ConflictException('Razorpay payment does not match the local order');
    }
    await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.payment.findUnique({
        where: { razorpayPaymentId: payment.id },
        select: { orderId: true },
      });
      if (existing && existing.orderId !== order.id) {
        throw new ConflictException('Razorpay payment is already linked to another order');
      }
      await transaction.payment.upsert({
        where: { razorpayPaymentId: payment.id },
        create: {
          orderId: order.id,
          razorpayPaymentId: payment.id,
          status: PaymentStatus.FAILED,
          amountPaise: payment.amount,
          currency: payment.currency,
          method: payment.method,
          rawPayload: this.json(payment),
        },
        update: {
          status: PaymentStatus.FAILED,
          method: payment.method,
          rawPayload: this.json(payment),
        },
      });
      await transaction.$executeRaw`select public.fail_pending_order(${order.id}::uuid)`;
    });
  }

  async reconcilePending(limit = 100): Promise<ReconciliationResult> {
    await this.prisma.$executeRaw`select public.release_expired_inventory_reservations()`;
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PAYMENT_PENDING,
        paymentProvider: PaymentProvider.RAZORPAY,
        razorpayOrderId: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
    const result: ReconciliationResult = {
      inspected: orders.length,
      confirmed: 0,
      failed: 0,
      pending: 0,
      errors: 0,
    };
    for (const order of orders) {
      try {
        const providerOrder = await this.razorpay.fetchOrder(order.razorpayOrderId!);
        if (providerOrder.status === 'paid') {
          const payments = await this.razorpay.fetchPaymentsForOrder(order.razorpayOrderId!);
          const captured = payments.find((payment) => payment.status === 'captured');
          if (!captured) {
            result.pending += 1;
            continue;
          }
          await this.applyCapturedPayment(order, captured);
          result.confirmed += 1;
        } else if (order.paymentExpiresAt <= new Date()) {
          await this.prisma.$executeRaw`select public.fail_pending_order(${order.id}::uuid)`;
          result.failed += 1;
        } else {
          result.pending += 1;
        }
      } catch {
        result.errors += 1;
      }
    }
    return result;
  }

  private assertMatchingOrder(order: Order, providerOrder: RazorpayOrder): void {
    if (
      providerOrder.amount !== order.totalPaise ||
      providerOrder.currency !== order.currency ||
      providerOrder.receipt !== order.orderNumber.slice(0, 40)
    ) {
      throw new ConflictException('Razorpay order amount or currency mismatch');
    }
  }

  private assertCapturedPayment(order: Order, payment: RazorpayPayment): void {
    if (payment.status !== 'captured' || payment.captured === false) {
      throw new ConflictException('Razorpay payment is not captured');
    }
    if (
      payment.order_id !== order.razorpayOrderId ||
      payment.amount !== order.totalPaise ||
      payment.currency !== order.currency
    ) {
      throw new ConflictException('Razorpay payment does not match the local order');
    }
  }

  private intentView(order: Order): PaymentIntent {
    if (!order.razorpayOrderId) {
      throw new ConflictException('Razorpay order was not created');
    }
    return {
      keyId: this.razorpay.publicKey(),
      razorpayOrderId: order.razorpayOrderId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.totalPaise,
      currency: order.currency,
      checkout: {
        items: order.itemsSnapshot,
        shippingAddress: order.addressSnapshot,
      },
    };
  }

  private providerDate(timestamp?: number): Date | undefined {
    return timestamp ? new Date(timestamp * 1000) : undefined;
  }

  private json(value: object): Prisma.InputJsonValue {
    return toInputJson(value);
  }
}
