import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';
import { WebhookProcessorService } from './webhook-processor.service';

describe('WebhookProcessorService', () => {
  const payment = {
    id: 'pay_1',
    entity: 'payment' as const,
    amount: 12_700,
    currency: 'INR',
    status: 'captured' as const,
    order_id: 'order_1',
  };
  const order = {
    id: '1b4e28ba-2fa1-11d2-883f-0016d3cca427',
    status: OrderStatus.PAYMENT_PENDING,
    razorpayOrderId: 'order_1',
  };
  let claimCount = 1;
  let prisma: {
    webhookEvent: {
      updateMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
    order: { findUnique: jest.Mock };
    refund: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let transaction: {
    refund: { update: jest.Mock; aggregate: jest.Mock };
    payment: { update: jest.Mock };
    returnRequest: { update: jest.Mock };
  };
  let payments: { applyCapturedPayment: jest.Mock; applyFailedPayment: jest.Mock };
  let razorpay: { fetchPaymentsForOrder: jest.Mock };
  let processor: WebhookProcessorService;

  beforeEach(() => {
    claimCount = 1;
    transaction = {
      refund: {
        update: jest.fn().mockResolvedValue({}),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amountPaise: 12_700 } }),
      },
      payment: { update: jest.fn().mockResolvedValue({}) },
      returnRequest: { update: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      webhookEvent: {
        updateMany: jest.fn(() => Promise.resolve({ count: claimCount })),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'event-local-1',
          payload: {
            event: 'payment.captured',
            payload: { payment: { entity: payment } },
          },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      refund: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'refund-local-1',
          paymentId: 'payment-local-1',
          returnRequestId: 'return-1',
          amountPaise: 12_700,
          currency: 'INR',
          payment: {
            id: 'payment-local-1',
            razorpayPaymentId: 'pay_1',
            amountPaise: 12_700,
          },
        }),
      },
      $transaction: jest.fn((callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    payments = {
      applyCapturedPayment: jest.fn().mockResolvedValue(undefined),
      applyFailedPayment: jest.fn().mockResolvedValue(undefined),
    };
    razorpay = { fetchPaymentsForOrder: jest.fn() };
    processor = new WebhookProcessorService(
      prisma as unknown as PrismaService,
      payments as unknown as PaymentsService,
      razorpay as unknown as RazorpayService,
    );
  });

  it('processes a captured payment once and marks the event processed', async () => {
    await processor.process('event-local-1');
    claimCount = 0;
    await processor.process('event-local-1');

    expect(payments.applyCapturedPayment).toHaveBeenCalledTimes(1);
    expect(payments.applyCapturedPayment).toHaveBeenCalledWith(order, payment);
    expect(prisma.webhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-local-1' },
      data: expect.objectContaining({ status: 'PROCESSED' }),
    });
  });

  it('marks a failed payment and delegates inventory release', async () => {
    const failedPayment = { ...payment, status: 'failed' as const };
    prisma.webhookEvent.findUniqueOrThrow.mockResolvedValue({
      id: 'event-local-1',
      payload: {
        event: 'payment.failed',
        payload: { payment: { entity: failedPayment } },
      },
    });

    await processor.process('event-local-1');

    expect(payments.applyFailedPayment).toHaveBeenCalledWith(order, failedPayment);
  });

  it('applies a processed refund webhook once despite duplicate delivery', async () => {
    prisma.webhookEvent.findUniqueOrThrow.mockResolvedValue({
      id: 'event-local-1',
      payload: {
        event: 'refund.processed',
        payload: {
          refund: {
            entity: {
              id: 'rfnd_1',
              amount: 12_700,
              currency: 'INR',
              payment_id: 'pay_1',
              status: 'processed',
            },
          },
        },
      },
    });

    await processor.process('event-local-1');
    claimCount = 0;
    await processor.process('event-local-1');

    expect(transaction.refund.update).toHaveBeenCalledTimes(1);
    expect(transaction.payment.update).toHaveBeenCalledTimes(1);
    expect(transaction.returnRequest.update).toHaveBeenCalledTimes(1);
  });
});
