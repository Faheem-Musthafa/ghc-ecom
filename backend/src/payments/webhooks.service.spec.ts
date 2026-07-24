import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaymentQueueService } from './payment-queue.service';
import { RazorpayService } from './razorpay.service';
import { WebhooksService } from './webhooks.service';

describe('WebhooksService', () => {
  const rawBody = Buffer.from('{"event":"payment.captured","payload":{}}');
  let prisma: {
    webhookEvent: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };
  let razorpay: { verifyWebhookSignature: jest.Mock };
  let queue: { enqueueWebhook: jest.Mock };
  let service: WebhooksService;

  beforeEach(() => {
    prisma = {
      webhookEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'event-local-1',
          providerEventId: 'event-provider-1',
        }),
      },
    };
    razorpay = { verifyWebhookSignature: jest.fn().mockReturnValue(true) };
    queue = { enqueueWebhook: jest.fn().mockResolvedValue(undefined) };
    service = new WebhooksService(
      prisma as unknown as PrismaService,
      razorpay as unknown as RazorpayService,
      queue as unknown as PaymentQueueService,
    );
  });

  it('rejects a tampered webhook before persistence', async () => {
    razorpay.verifyWebhookSignature.mockReturnValue(false);

    await expect(service.ingest(rawBody, 'invalid', 'event-provider-1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
    expect(queue.enqueueWebhook).not.toHaveBeenCalled();
  });

  it('persists and enqueues a valid event', async () => {
    await service.ingest(rawBody, 'valid', 'event-provider-1');

    expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerEventId: 'event-provider-1',
        eventType: 'payment.captured',
      }),
    });
    expect(queue.enqueueWebhook).toHaveBeenCalledWith('event-local-1');
  });

  it('accepts duplicate processed delivery without creating or enqueuing it again', async () => {
    prisma.webhookEvent.findUnique.mockResolvedValue({
      id: 'event-local-1',
      status: 'PROCESSED',
    });

    await service.ingest(rawBody, 'valid', 'event-provider-1');

    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
    expect(queue.enqueueWebhook).not.toHaveBeenCalled();
  });
});
