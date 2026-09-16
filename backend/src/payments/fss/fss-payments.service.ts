import { randomInt } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Order, OrderStatus, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { CartService } from '../../cart/cart.service';
import { PrismaService } from '../../database/prisma.service';
import { orderCreateData, requireActiveQuote, toInputJson } from '../order-factory';
import { ReconciliationResult } from '../payments.service';
import { CreateFssIntentDto } from './dto/create-fss-intent.dto';
import { FssGatewayResult, FssGatewayService, FssPaymentRequest } from './fss-gateway.service';

export interface FssPaymentIntent {
  provider: 'fss';
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  gateway: FssPaymentRequest;
}

export type FssResultOutcome = 'success' | 'failed' | 'pending';

@Injectable()
export class FssPaymentsService {
  private readonly logger = new Logger(FssPaymentsService.name);
  private readonly frontendOrigin: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly carts: CartService,
    private readonly gateway: FssGatewayService,
    config: ConfigService,
  ) {
    this.frontendOrigin = config.getOrThrow<string>('FRONTEND_ORIGIN');
  }

  async createIntent(
    input: CreateFssIntentDto,
    authorization?: string,
    guestToken?: string,
  ): Promise<FssPaymentIntent> {
    this.requireEnabled();
    const quote = await this.prisma.checkoutQuote.findUnique({ where: { id: input.quoteId } });
    if (!quote) {
      throw new NotFoundException('Checkout quote not found');
    }
    await this.carts.requireAccessibleCart(quote.cartId, authorization, guestToken);
    requireActiveQuote(quote);

    const order = await this.prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`select pg_advisory_xact_lock(
          hashtextextended(${quote.id}::text, 0)
        )`;
        const existing = await transaction.order.findUnique({ where: { quoteId: quote.id } });
        if (existing?.fssTrackId) {
          return existing;
        }
        if (existing) {
          throw new ConflictException('Order is already assigned to another payment gateway');
        }
        return transaction.order.create({
          data: {
            ...orderCreateData(quote, PaymentProvider.FSS),
            fssTrackId: FssPaymentsService.newTrackId(),
          },
        });
      },
      { timeout: 20_000 },
    );
    return {
      provider: 'fss',
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.totalPaise,
      currency: order.currency,
      gateway: this.gateway.buildPaymentRequest(order),
    };
  }

  /**
   * Handles the bank's Response/Error URL call. Never throws for gateway input
   * problems: the customer must always be sent to a result page.
   */
  async handleGatewayResponse(body: Record<string, unknown>): Promise<string> {
    if (!this.gateway.isEnabled()) {
      return this.resultUrl('failed');
    }
    let result: FssGatewayResult;
    try {
      result = this.gateway.parseResponse(body);
    } catch (error) {
      this.logger.warn(`FSS response could not be parsed: ${this.describe(error)}`);
      return this.resultUrl('failed');
    }
    if (!result.trackId) {
      this.logger.warn('FSS response did not include a track ID');
      return this.resultUrl('failed');
    }
    const order = await this.prisma.order.findUnique({ where: { fssTrackId: result.trackId } });
    if (!order) {
      this.logger.warn(`FSS response referenced unknown track ID ${result.trackId}`);
      return this.resultUrl('failed');
    }
    if (order.status !== OrderStatus.PAYMENT_PENDING) {
      if (
        result.verified &&
        result.outcome === 'captured' &&
        FssPaymentsService.outcomeFor(order) === 'failed'
      ) {
        await this.recordLateCapture(order, result);
      }
      return this.resultUrl(FssPaymentsService.outcomeFor(order), order);
    }
    if (!result.verified) {
      // A plaintext callback is not authenticated; confirm with the bank directly.
      this.logger.warn(`FSS response for ${order.orderNumber} was not encrypted; running inquiry`);
      try {
        result = await this.gateway.inquire(order);
      } catch (error) {
        this.logger.error(`FSS inquiry failed for ${order.orderNumber}: ${this.describe(error)}`);
        return this.resultUrl('pending', order);
      }
    }
    try {
      await this.apply(order, result);
    } catch (error) {
      this.logger.error(
        `FSS result could not be applied to ${order.orderNumber}: ${this.describe(error)}`,
      );
      return this.resultUrl('pending', order);
    }
    const updated = await this.prisma.order.findUnique({ where: { id: order.id } });
    return this.resultUrl(FssPaymentsService.outcomeFor(updated ?? order), order);
  }

  async resolveStatus(
    orderId: string,
    authorization?: string,
    guestToken?: string,
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.paymentProvider !== PaymentProvider.FSS) {
      throw new NotFoundException('Order not found');
    }
    await this.carts.requireOwnedCart(order.cartId, authorization, guestToken);
    if (order.status !== OrderStatus.PAYMENT_PENDING) {
      return order;
    }
    await this.settlePending(order);
    return (await this.prisma.order.findUnique({ where: { id: order.id } })) ?? order;
  }

  async reconcilePending(limit = 100): Promise<ReconciliationResult> {
    const result: ReconciliationResult = {
      inspected: 0,
      confirmed: 0,
      failed: 0,
      pending: 0,
      errors: 0,
    };
    if (!this.gateway.isEnabled()) {
      return result;
    }
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PAYMENT_PENDING,
        paymentProvider: PaymentProvider.FSS,
        fssTrackId: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
    result.inspected = orders.length;
    for (const order of orders) {
      try {
        const status = await this.settlePending(order);
        result[status] += 1;
      } catch {
        result.errors += 1;
      }
    }
    return result;
  }

  private async settlePending(order: Order): Promise<'confirmed' | 'failed' | 'pending'> {
    if (!this.gateway.isEnabled()) {
      return 'pending';
    }
    const result = await this.gateway.inquire(order);
    if (result.outcome === 'captured') {
      await this.apply(order, result);
      return 'confirmed';
    }
    if (result.outcome === 'failed' || order.paymentExpiresAt <= new Date()) {
      await this.apply(order, { ...result, outcome: 'failed' });
      return 'failed';
    }
    return 'pending';
  }

  private async apply(order: Order, result: FssGatewayResult): Promise<void> {
    if (result.outcome === 'pending') {
      return;
    }
    if (result.outcome === 'captured') {
      if (result.amountPaise !== null && result.amountPaise !== order.totalPaise) {
        throw new ConflictException('FSS captured amount does not match the local order');
      }
      await this.applyCaptured(order, result);
      return;
    }
    await this.applyFailed(order, result);
  }

  private async applyCaptured(order: Order, result: FssGatewayResult): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await this.upsertCapturedPayment(transaction, order, result);
      await transaction.$executeRaw`select public.confirm_paid_order(${order.id}::uuid)`;
    });
  }

  /**
   * The bank captured funds for an order that already expired or was cancelled
   * (for example a slow customer after reconciliation failed the order). Keep the
   * captured payment on record so support can refund it from the bank portal.
   */
  private async recordLateCapture(order: Order, result: FssGatewayResult): Promise<void> {
    try {
      await this.prisma.$transaction((transaction) =>
        this.upsertCapturedPayment(transaction, order, result),
      );
      this.logger.error(
        `FSS captured ${result.amountPaise ?? order.totalPaise} paise for ${order.orderNumber} after it reached ${order.status}; refund it from the bank merchant portal`,
      );
    } catch (error) {
      this.logger.error(
        `FSS late capture for ${order.orderNumber} could not be recorded: ${this.describe(error)}`,
      );
    }
  }

  private async upsertCapturedPayment(
    transaction: Prisma.TransactionClient,
    order: Order,
    result: FssGatewayResult,
  ): Promise<void> {
    const fssTransactionId = result.paymentId ?? result.transactionId ?? order.fssTrackId!;
    const existing = await transaction.payment.findUnique({
      where: { fssTransactionId },
      select: { orderId: true },
    });
    if (existing && existing.orderId !== order.id) {
      throw new ConflictException('FSS payment is already linked to another order');
    }
    await transaction.payment.upsert({
      where: { fssTransactionId },
      create: {
        orderId: order.id,
        provider: PaymentProvider.FSS,
        fssTransactionId,
        status: PaymentStatus.CAPTURED,
        amountPaise: result.amountPaise ?? order.totalPaise,
        currency: order.currency,
        signatureVerified: result.verified,
        method: result.paymentMethod ?? undefined,
        capturedAt: new Date(),
        rawPayload: toInputJson(result.raw),
      },
      update: {
        status: PaymentStatus.CAPTURED,
        signatureVerified: result.verified ? true : undefined,
        method: result.paymentMethod ?? undefined,
        capturedAt: new Date(),
        rawPayload: toInputJson(result.raw),
      },
    });
  }

  private async applyFailed(order: Order, result: FssGatewayResult): Promise<void> {
    const fssTransactionId = result.paymentId ?? result.transactionId;
    await this.prisma.$transaction(async (transaction) => {
      if (fssTransactionId) {
        const existing = await transaction.payment.findUnique({
          where: { fssTransactionId },
          select: { orderId: true, status: true },
        });
        if (existing && existing.orderId !== order.id) {
          throw new ConflictException('FSS payment is already linked to another order');
        }
        // Never downgrade a captured payment on a late failure callback.
        if (existing?.status !== PaymentStatus.CAPTURED) {
          await transaction.payment.upsert({
            where: { fssTransactionId },
            create: {
              orderId: order.id,
              provider: PaymentProvider.FSS,
              fssTransactionId,
              status: PaymentStatus.FAILED,
              amountPaise: result.amountPaise ?? order.totalPaise,
              currency: order.currency,
              signatureVerified: result.verified,
              method: result.paymentMethod ?? undefined,
              rawPayload: toInputJson(result.raw),
            },
            update: {
              status: PaymentStatus.FAILED,
              rawPayload: toInputJson(result.raw),
            },
          });
        }
      }
      await transaction.$executeRaw`select public.fail_pending_order(${order.id}::uuid)`;
    });
  }

  private requireEnabled(): void {
    if (!this.gateway.isEnabled()) {
      throw new ServiceUnavailableException('Bank payment gateway is not enabled');
    }
  }

  resultUrl(outcome: FssResultOutcome, order?: Pick<Order, 'id'>): string {
    const url = new URL('/checkout/result', this.frontendOrigin);
    url.searchParams.set('outcome', outcome);
    if (order) url.searchParams.set('order', order.id);
    return url.toString();
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  static outcomeFor(order: Pick<Order, 'status'>): FssResultOutcome {
    if (order.status === OrderStatus.PAYMENT_PENDING) return 'pending';
    if (order.status === OrderStatus.PAYMENT_FAILED || order.status === OrderStatus.CANCELLED) {
      return 'failed';
    }
    return 'success';
  }

  /** Numeric, time-ordered and unique enough for FSS `trackid` limits (≤ 20 chars). */
  static newTrackId(): string {
    return `${Date.now()}${randomInt(0, 1_000_000).toString().padStart(6, '0')}`;
  }
}
