import { Injectable, NotFoundException } from '@nestjs/common';
import { Order, PaymentStatus, RefundStatus, ReturnStatus, WebhookStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PaymentsService } from './payments.service';
import { RazorpayPayment, RazorpayService } from './razorpay.service';

interface RazorpayWebhookPayload {
  event: string;
  payload?: {
    payment?: { entity?: RazorpayPayment };
    order?: { entity?: { id?: string } };
    refund?: {
      entity?: {
        id?: string;
        amount?: number;
        currency?: string;
        payment_id?: string;
        status?: 'pending' | 'processed' | 'failed';
      };
    };
  };
}

@Injectable()
export class WebhookProcessorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly razorpay: RazorpayService,
  ) {}

  async process(eventId: string): Promise<void> {
    const claimed = await this.prisma.webhookEvent.updateMany({
      where: {
        id: eventId,
        status: { in: [WebhookStatus.RECEIVED, WebhookStatus.FAILED] },
      },
      data: {
        status: WebhookStatus.PROCESSING,
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    if (claimed.count === 0) {
      return;
    }

    try {
      const event = await this.prisma.webhookEvent.findUniqueOrThrow({ where: { id: eventId } });
      await this.handle(event.payload as unknown as RazorpayWebhookPayload);
      await this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: {
          status: WebhookStatus.PROCESSED,
          processedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: {
          status: WebhookStatus.FAILED,
          lastError: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error',
        },
      });
      throw error;
    }
  }

  private async handle(payload: RazorpayWebhookPayload): Promise<void> {
    if (payload.event.startsWith('refund.')) {
      await this.handleRefund(payload);
      return;
    }
    if (payload.event === 'payment.captured') {
      const payment = this.requirePayment(payload);
      const order = await this.orderByProviderId(payment.order_id);
      await this.payments.applyCapturedPayment(order, payment);
      return;
    }
    if (payload.event === 'payment.failed') {
      const payment = this.requirePayment(payload);
      const order = await this.orderByProviderId(payment.order_id);
      await this.payments.applyFailedPayment(order, payment);
      return;
    }
    if (payload.event === 'order.paid') {
      const payment = payload.payload?.payment?.entity;
      if (payment?.status === 'captured') {
        const order = await this.orderByProviderId(payment.order_id);
        await this.payments.applyCapturedPayment(order, payment);
        return;
      }
      const providerOrderId = payload.payload?.order?.entity?.id;
      const order = await this.orderByProviderId(providerOrderId ?? null);
      const providerPayments = await this.razorpay.fetchPaymentsForOrder(providerOrderId!);
      const captured = providerPayments.find((item) => item.status === 'captured');
      if (!captured) {
        throw new NotFoundException('Captured payment was not found for paid order');
      }
      await this.payments.applyCapturedPayment(order, captured);
    }
  }

  private async handleRefund(payload: RazorpayWebhookPayload): Promise<void> {
    const entity = payload.payload?.refund?.entity;
    if (!entity?.id || !entity.payment_id || !entity.status) {
      throw new NotFoundException('Webhook refund entity is missing');
    }
    const refund = await this.prisma.refund.findUnique({
      where: { razorpayRefundId: entity.id },
      include: { payment: true },
    });
    if (!refund) {
      throw new NotFoundException('Local refund was not found for webhook');
    }
    if (
      entity.payment_id !== refund.payment.razorpayPaymentId ||
      entity.amount !== refund.amountPaise ||
      entity.currency !== refund.currency
    ) {
      throw new NotFoundException('Webhook refund does not match local refund');
    }
    const status =
      entity.status === 'processed'
        ? RefundStatus.PROCESSED
        : entity.status === 'failed'
          ? RefundStatus.FAILED
          : RefundStatus.PENDING;
    await this.prisma.$transaction(async (transaction) => {
      await transaction.refund.update({
        where: { id: refund.id },
        data: {
          status,
          rawPayload: entity,
          processedAt: status === RefundStatus.PROCESSED ? new Date() : undefined,
        },
      });
      if (status !== RefundStatus.PROCESSED) return;
      const totals = await transaction.refund.aggregate({
        where: { paymentId: refund.paymentId, status: RefundStatus.PROCESSED },
        _sum: { amountPaise: true },
      });
      if ((totals._sum.amountPaise ?? 0) >= refund.payment.amountPaise) {
        await transaction.payment.update({
          where: { id: refund.paymentId },
          data: { status: PaymentStatus.REFUNDED },
        });
      }
      if (refund.returnRequestId) {
        await transaction.returnRequest.update({
          where: { id: refund.returnRequestId },
          data: { status: ReturnStatus.REFUNDED },
        });
      }
    });
  }

  private requirePayment(payload: RazorpayWebhookPayload): RazorpayPayment {
    const payment = payload.payload?.payment?.entity;
    if (!payment?.id || !payment.order_id) {
      throw new NotFoundException('Webhook payment entity is missing');
    }
    return payment;
  }

  private async orderByProviderId(razorpayOrderId: string | null): Promise<Order> {
    if (!razorpayOrderId) {
      throw new NotFoundException('Webhook payment has no Razorpay order');
    }
    const order = await this.prisma.order.findUnique({ where: { razorpayOrderId } });
    if (!order) {
      throw new NotFoundException('Local order was not found for webhook');
    }
    return order;
  }
}
