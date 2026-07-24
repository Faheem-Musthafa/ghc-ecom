import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentStatus, RefundStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { RazorpayService } from '../payments/razorpay.service';
import { RefundsService } from './refunds.service';

describe('RefundsService', () => {
  const payment = {
    id: '1b4e28ba-2fa1-11d2-883f-0016d3cca427',
    razorpayPaymentId: 'pay_1',
    status: PaymentStatus.CAPTURED,
    amountPaise: 10_000,
    currency: 'INR',
  };
  const local: {
    id: string;
    paymentId: string;
    idempotencyKey: string;
    amountPaise: number;
    status: RefundStatus;
    returnRequestId: string | null;
    reason: string | null;
  } = {
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    paymentId: payment.id,
    idempotencyKey: 'refund_key_123',
    amountPaise: 4_000,
    status: RefundStatus.PENDING,
    returnRequestId: null,
    reason: null,
  };
  let savedRefund: typeof local | null;
  let transaction: {
    $executeRaw: jest.Mock;
    refund: {
      findUnique: jest.Mock;
      aggregate: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    payment: { findUnique: jest.Mock; update: jest.Mock };
    returnRequest: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let prisma: {
    refund: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      aggregate: jest.Mock;
    };
    payment: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let razorpay: { createRefund: jest.Mock; fetchRefund: jest.Mock };
  let audit: { record: jest.Mock };
  let service: RefundsService;

  beforeEach(() => {
    savedRefund = null;
    transaction = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      refund: {
        findUnique: jest.fn(() => Promise.resolve(savedRefund)),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amountPaise: 0 } }),
        create: jest.fn().mockImplementation(() => {
          savedRefund = local;
          return Promise.resolve(local);
        }),
        update: jest.fn().mockImplementation(() => {
          savedRefund = {
            ...local,
            status: RefundStatus.PROCESSED,
          };
          return Promise.resolve(savedRefund);
        }),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(payment),
        update: jest.fn().mockResolvedValue({}),
      },
      returnRequest: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma = {
      refund: {
        findUnique: jest.fn(() => Promise.resolve(savedRefund)),
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amountPaise: 0 },
        }),
      },
      payment: { findFirst: jest.fn().mockResolvedValue(payment) },
      $transaction: jest.fn((callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    razorpay = {
      createRefund: jest.fn().mockResolvedValue({
        id: 'rfnd_1',
        entity: 'refund',
        amount: 4_000,
        currency: 'INR',
        payment_id: 'pay_1',
        status: 'processed',
      }),
      fetchRefund: jest.fn(),
    };
    audit = { record: jest.fn().mockResolvedValue({}) };
    service = new RefundsService(
      prisma as unknown as PrismaService,
      razorpay as unknown as RazorpayService,
      audit as unknown as AuditService,
    );
  });

  it('creates exactly one provider refund for an idempotency key', async () => {
    const input = {
      paymentId: payment.id,
      amountPaise: 4_000,
      idempotencyKey: 'refund_key_123',
    };
    const first = await service.create('admin-1', input);
    const second = await service.create('admin-1', input);

    expect(first.id).toBe(local.id);
    expect(second.id).toBe(local.id);
    expect(razorpay.createRefund).toHaveBeenCalledTimes(1);
    expect(razorpay.createRefund).toHaveBeenCalledWith(
      'pay_1',
      expect.objectContaining({ amount: 4_000 }),
      'refund_key_123',
    );
  });

  it('rejects cumulative partial refunds above the captured amount', async () => {
    transaction.refund.aggregate.mockResolvedValue({ _sum: { amountPaise: 8_000 } });

    await expect(
      service.create('admin-1', {
        paymentId: payment.id,
        amountPaise: 3_000,
        idempotencyKey: 'refund_key_456',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(razorpay.createRefund).not.toHaveBeenCalled();
  });

  it('rejects reuse of an idempotency key with a different payload', async () => {
    savedRefund = local;

    await expect(
      service.create('admin-1', {
        paymentId: payment.id,
        amountPaise: 3_000,
        idempotencyKey: local.idempotencyKey,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(razorpay.createRefund).not.toHaveBeenCalled();
  });

  it('reconciles a pending refund when the final webhook is missing', async () => {
    prisma.refund.findMany.mockResolvedValue([
      {
        ...local,
        razorpayRefundId: 'rfnd_1',
        payment,
      },
    ]);
    razorpay.fetchRefund.mockResolvedValue({
      id: 'rfnd_1',
      entity: 'refund',
      amount: 4_000,
      currency: 'INR',
      payment_id: 'pay_1',
      status: 'processed',
    });

    await expect(service.reconcilePending()).resolves.toEqual({
      inspected: 1,
      processed: 1,
      pending: 0,
      failed: 0,
      errors: 0,
    });
    expect(transaction.refund.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: local.id },
        data: expect.objectContaining({ status: RefundStatus.PROCESSED }),
      }),
    );
  });

  it('marks a fully processed payment refunded from the trusted API response', async () => {
    transaction.refund.aggregate
      .mockResolvedValueOnce({ _sum: { amountPaise: 0 } })
      .mockResolvedValueOnce({ _sum: { amountPaise: 10_000 } });
    razorpay.createRefund.mockResolvedValue({
      id: 'rfnd_full',
      entity: 'refund',
      amount: 10_000,
      currency: 'INR',
      payment_id: 'pay_1',
      status: 'processed',
    });

    await service.create('admin-1', {
      paymentId: payment.id,
      amountPaise: 10_000,
      idempotencyKey: 'refund_full_123',
    });

    expect(transaction.payment.update).toHaveBeenCalledWith({
      where: { id: payment.id },
      data: { status: PaymentStatus.REFUNDED },
    });
  });

  it('automatically refunds only the remaining captured amount after cancellation', async () => {
    prisma.refund.aggregate.mockResolvedValue({
      _sum: { amountPaise: 2_000 },
    });
    const create = jest.spyOn(service, 'create').mockResolvedValue(local as never);

    await service.refundOrderCancellation('1b4e28ba-2fa1-11d2-883f-0016d3cca427');

    expect(create).toHaveBeenCalledWith(undefined, {
      paymentId: payment.id,
      amountPaise: 8_000,
      idempotencyKey: 'cancel_1b4e28ba_2fa1_11d2_883f_0016d3cca427',
      reason: 'Automatic pre-fulfilment order cancellation refund',
    });
  });
});
