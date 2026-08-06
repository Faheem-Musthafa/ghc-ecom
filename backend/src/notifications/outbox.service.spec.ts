import { NotificationChannel, NotificationStatus, OrderStatus, OutboxStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RefundsService } from '../fulfilment/refunds.service';
import { InvoiceService } from '../orders/invoice.service';
import { NotificationSenderService } from './notification-sender.service';
import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  const order = {
    id: '1b4e28ba-2fa1-11d2-883f-0016d3cca427',
    orderNumber: 'GHC-TEST-1',
    status: OrderStatus.CONFIRMED,
    totalPaise: 11_198,
    createdAt: new Date('2026-08-06T12:00:00.000Z'),
    itemsSnapshot: [
      {
        productName: 'Noir Gold Tea Set',
        variantName: 'Six cup set',
        sku: 'GHC-TEA-006',
        quantity: 1,
        lineTotalPaise: 11_198,
      },
    ],
    addressSnapshot: {
      recipientName: 'Customer',
      email: 'customer@example.com',
      phone: '9876543210',
    },
  };
  const event = {
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    aggregateType: 'order',
    aggregateId: order.id,
    eventType: 'order.confirmed',
    dedupeKey: `order-confirmed:${order.id}`,
    payload: { orderId: order.id },
    status: OutboxStatus.PENDING,
    attempts: 0,
    availableAt: new Date(),
    lastError: null,
    processedAt: null,
    createdAt: new Date(),
  };
  let prisma: {
    outboxEvent: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    order: { findUniqueOrThrow: jest.Mock };
    notification: {
      upsert: jest.Mock;
      update: jest.Mock;
    };
  };
  let invoices: { ensure: jest.Mock };
  let sender: { supports: jest.Mock; send: jest.Mock };
  let refunds: { refundOrderCancellation: jest.Mock };
  let service: OutboxService;

  beforeEach(() => {
    prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([event]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      order: { findUniqueOrThrow: jest.fn().mockResolvedValue(order) },
      notification: {
        upsert: jest.fn().mockResolvedValue({
          id: 'notification-1',
          status: NotificationStatus.PENDING,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    invoices = { ensure: jest.fn().mockResolvedValue({ id: 'invoice-1' }) };
    sender = {
      supports: jest.fn((channel: NotificationChannel) => channel === NotificationChannel.EMAIL),
      send: jest.fn().mockResolvedValue('provider-message-1'),
    };
    refunds = {
      refundOrderCancellation: jest.fn().mockResolvedValue(null),
    };
    service = new OutboxService(
      prisma as unknown as PrismaService,
      invoices as unknown as InvoiceService,
      sender as unknown as NotificationSenderService,
      refunds as unknown as RefundsService,
    );
  });

  it('creates one invoice and one configured notification for order confirmation', async () => {
    await expect(service.processPending()).resolves.toBe(1);

    expect(invoices.ensure).toHaveBeenCalledTimes(1);
    expect(prisma.notification.upsert).toHaveBeenCalledTimes(1);
    expect(sender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: NotificationChannel.EMAIL,
        recipient: 'customer@example.com',
      }),
    );
    expect(prisma.outboxEvent.update).toHaveBeenLastCalledWith({
      where: { id: event.id },
      data: expect.objectContaining({ status: OutboxStatus.PROCESSED }),
    });
  });

  it('records notification failure and leaves a terminal fifth-attempt outbox event observable', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([{ ...event, attempts: 4 }]);
    sender.send.mockRejectedValue(new Error('SMTP unavailable'));

    await expect(service.processPending()).resolves.toBe(1);

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-1' },
      data: expect.objectContaining({
        status: NotificationStatus.FAILED,
        lastError: 'SMTP unavailable',
      }),
    });
    expect(prisma.outboxEvent.update).toHaveBeenLastCalledWith({
      where: { id: event.id },
      data: expect.objectContaining({
        status: OutboxStatus.FAILED,
        lastError: 'SMTP unavailable',
      }),
    });
  });

  it('requests the remaining captured amount refund for a cancelled order', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        ...event,
        eventType: 'order.cancelled',
        dedupeKey: `order-cancelled:${order.id}`,
      },
    ]);

    await service.processPending();

    expect(refunds.refundOrderCancellation).toHaveBeenCalledTimes(1);
    expect(refunds.refundOrderCancellation).toHaveBeenCalledWith(order.id);
    expect(invoices.ensure).not.toHaveBeenCalled();
  });
});
