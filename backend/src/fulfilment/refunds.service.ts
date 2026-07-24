import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Payment, PaymentStatus, Prisma, Refund, RefundStatus, ReturnStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { RazorpayRefund, RazorpayService } from '../payments/razorpay.service';
import { CreateRefundDto } from './dto/create-refund.dto';

export interface RefundReconciliationResult {
  inspected: number;
  processed: number;
  pending: number;
  failed: number;
  errors: number;
}

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly audit: AuditService,
  ) {}

  async create(actorId: string | undefined, input: CreateRefundDto): Promise<Refund> {
    const existing = await this.prisma.refund.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return this.requireSameRequest(existing, input);

    const refund = await this.prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`select pg_advisory_xact_lock(
          hashtextextended(${input.paymentId}::text, 0)
        )`;
        const raced = await transaction.refund.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (raced) return this.requireSameRequest(raced, input);
        const payment = await transaction.payment.findUnique({
          where: { id: input.paymentId },
        });
        if (
          !payment ||
          (payment.status !== PaymentStatus.CAPTURED && payment.status !== PaymentStatus.REFUNDED)
        ) {
          throw new NotFoundException('Captured payment not found');
        }
        if (input.returnRequestId) {
          const request = await transaction.returnRequest.findUnique({
            where: { id: input.returnRequestId },
          });
          if (!request || request.status !== ReturnStatus.RECEIVED) {
            throw new BadRequestException('Return must be received before refund');
          }
        }
        const aggregate = await transaction.refund.aggregate({
          where: {
            paymentId: payment.id,
            status: { not: RefundStatus.FAILED },
          },
          _sum: { amountPaise: true },
        });
        if ((aggregate._sum.amountPaise ?? 0) + input.amountPaise > payment.amountPaise) {
          throw new BadRequestException('Refund exceeds the captured payment amount');
        }
        const local = await transaction.refund.create({
          data: {
            paymentId: payment.id,
            returnRequestId: input.returnRequestId,
            idempotencyKey: input.idempotencyKey,
            amountPaise: input.amountPaise,
            currency: payment.currency,
            reason: input.reason,
          },
        });
        const provider = await this.razorpay.createRefund(
          payment.razorpayPaymentId,
          {
            amount: input.amountPaise,
            receipt: local.id.slice(0, 40),
            notes: { local_refund_id: local.id },
          },
          input.idempotencyKey,
        );
        this.assertProviderRefund(payment.razorpayPaymentId, input.amountPaise, provider);
        return this.persistProviderState(transaction, local, payment, provider);
      },
      { timeout: 20_000 },
    );
    await this.audit.record({
      actorId,
      action: 'refund.created',
      entityType: 'refund',
      entityId: refund.id,
      metadata: {
        paymentId: input.paymentId,
        amountPaise: input.amountPaise,
        idempotencyKey: input.idempotencyKey,
      },
    });
    return refund;
  }

  async refundOrderCancellation(orderId: string): Promise<Refund | null> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId,
        status: { in: [PaymentStatus.CAPTURED, PaymentStatus.REFUNDED] },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!payment) return null;
    const aggregate = await this.prisma.refund.aggregate({
      where: {
        paymentId: payment.id,
        status: { not: RefundStatus.FAILED },
      },
      _sum: { amountPaise: true },
    });
    const remaining = payment.amountPaise - (aggregate._sum.amountPaise ?? 0);
    if (remaining <= 0) return null;
    return this.create(undefined, {
      paymentId: payment.id,
      amountPaise: remaining,
      idempotencyKey: `cancel_${orderId.replaceAll('-', '_')}`,
      reason: 'Automatic pre-fulfilment order cancellation refund',
    });
  }

  async reconcilePending(limit = 100): Promise<RefundReconciliationResult> {
    const refunds = await this.prisma.refund.findMany({
      where: {
        status: RefundStatus.PENDING,
        razorpayRefundId: { not: null },
      },
      include: { payment: true },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
    const result: RefundReconciliationResult = {
      inspected: refunds.length,
      processed: 0,
      pending: 0,
      failed: 0,
      errors: 0,
    };
    for (const refund of refunds) {
      try {
        const provider = await this.razorpay.fetchRefund(refund.razorpayRefundId!);
        this.assertProviderRefund(refund.payment.razorpayPaymentId, refund.amountPaise, provider);
        await this.prisma.$transaction((transaction) =>
          this.persistProviderState(transaction, refund, refund.payment, provider),
        );
        result[this.resultKey(provider.status)] += 1;
      } catch {
        result.errors += 1;
      }
    }
    return result;
  }

  private requireSameRequest(refund: Refund, input: CreateRefundDto): Refund {
    if (
      refund.paymentId !== input.paymentId ||
      refund.returnRequestId !== (input.returnRequestId ?? null) ||
      refund.amountPaise !== input.amountPaise ||
      (refund.reason ?? null) !== (input.reason ?? null)
    ) {
      throw new ConflictException(
        'Idempotency key was already used for a different refund request',
      );
    }
    return refund;
  }

  private async persistProviderState(
    transaction: Prisma.TransactionClient,
    refund: Refund,
    payment: Payment,
    provider: RazorpayRefund,
  ): Promise<Refund> {
    const status = this.status(provider.status);
    const saved = await transaction.refund.update({
      where: { id: refund.id },
      data: {
        razorpayRefundId: provider.id,
        status,
        rawPayload: this.json(provider),
        processedAt: provider.status === 'processed' ? new Date() : undefined,
      },
    });
    if (refund.returnRequestId) {
      if (status === RefundStatus.PROCESSED) {
        await transaction.returnRequest.update({
          where: { id: refund.returnRequestId },
          data: { status: ReturnStatus.REFUNDED },
        });
      } else if (status === RefundStatus.PENDING) {
        await transaction.returnRequest.updateMany({
          where: {
            id: refund.returnRequestId,
            status: ReturnStatus.RECEIVED,
          },
          data: { status: ReturnStatus.REFUND_PENDING },
        });
      } else {
        await transaction.returnRequest.updateMany({
          where: {
            id: refund.returnRequestId,
            status: ReturnStatus.REFUND_PENDING,
          },
          data: { status: ReturnStatus.RECEIVED },
        });
      }
    }
    if (status === RefundStatus.PROCESSED) {
      const aggregate = await transaction.refund.aggregate({
        where: {
          paymentId: payment.id,
          status: RefundStatus.PROCESSED,
        },
        _sum: { amountPaise: true },
      });
      if ((aggregate._sum.amountPaise ?? 0) >= payment.amountPaise) {
        await transaction.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.REFUNDED },
        });
      }
    }
    return saved;
  }

  private assertProviderRefund(
    paymentId: string,
    amountPaise: number,
    refund: RazorpayRefund,
  ): void {
    if (
      refund.payment_id !== paymentId ||
      refund.amount !== amountPaise ||
      refund.currency !== 'INR'
    ) {
      throw new BadRequestException('Razorpay refund does not match the request');
    }
  }

  private status(status: RazorpayRefund['status']): RefundStatus {
    if (status === 'processed') return RefundStatus.PROCESSED;
    if (status === 'failed') return RefundStatus.FAILED;
    return RefundStatus.PENDING;
  }

  private resultKey(status: RazorpayRefund['status']): 'processed' | 'pending' | 'failed' {
    return status;
  }

  private json(value: object): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
