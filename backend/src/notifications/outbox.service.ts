import { Injectable } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationStatus,
  Order,
  OutboxEvent,
  OutboxStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RefundsService } from '../fulfilment/refunds.service';
import { InvoiceService } from '../orders/invoice.service';
import { NotificationMessage, NotificationSenderService } from './notification-sender.service';

const MAX_ATTEMPTS = 5;

interface AddressContact {
  email?: string;
  phone?: string;
  recipientName?: string;
}

@Injectable()
export class OutboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoiceService,
    private readonly sender: NotificationSenderService,
    private readonly refunds: RefundsService,
  ) {}

  async processPending(limit = 25): Promise<number> {
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
        attempts: { lt: MAX_ATTEMPTS },
        availableAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    let processed = 0;
    for (const event of events) {
      if (await this.claim(event.id)) {
        await this.processClaimed(event);
        processed += 1;
      }
    }
    return processed;
  }

  private async claim(id: string): Promise<boolean> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
        attempts: { lt: MAX_ATTEMPTS },
      },
      data: {
        status: OutboxStatus.PROCESSING,
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    return result.count === 1;
  }

  private async processClaimed(event: OutboxEvent): Promise<void> {
    try {
      if (event.aggregateType === 'order') {
        await this.processOrderEvent(event);
      }
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxStatus.PROCESSED,
          processedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      const attempts = event.attempts + 1;
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxStatus.FAILED,
          lastError: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error',
          availableAt: new Date(Date.now() + this.retryDelay(attempts)),
        },
      });
    }
  }

  private async processOrderEvent(event: OutboxEvent): Promise<void> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: event.aggregateId },
    });
    if (event.eventType === 'order.confirmed') {
      await this.invoices.ensure(order);
    }
    if (event.eventType === 'order.cancelled') {
      await this.refunds.refundOrderCancellation(order.id);
    }
    if (!['order.confirmed', 'order.cancelled'].includes(event.eventType)) {
      return;
    }
    for (const message of this.messages(order, event.eventType)) {
      await this.deliver(event, order, message);
    }
  }

  private async deliver(
    event: OutboxEvent,
    order: Order,
    message: NotificationMessage,
  ): Promise<void> {
    const notification = await this.prisma.notification.upsert({
      where: {
        outboxEventId_channel_recipient: {
          outboxEventId: event.id,
          channel: message.channel,
          recipient: message.recipient,
        },
      },
      create: {
        orderId: order.id,
        outboxEventId: event.id,
        channel: message.channel,
        recipient: message.recipient,
        template: event.eventType,
      },
      update: {},
    });
    if (notification.status === NotificationStatus.SENT) {
      return;
    }
    try {
      const providerRef = await this.sender.send(message);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          attempts: { increment: 1 },
          providerRef,
          sentAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          attempts: { increment: 1 },
          lastError: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error',
        },
      });
      throw error;
    }
  }

  private messages(order: Order, eventType: string): NotificationMessage[] {
    const contact = this.contact(order.addressSnapshot);
    const state = eventType === 'order.confirmed' ? 'confirmed' : 'cancelled';
    const subject = `Order ${order.orderNumber} ${state}`;
    const text = `Hello ${contact.recipientName ?? 'customer'}, your order ${order.orderNumber} is ${state}.`;
    const candidates: Array<[NotificationChannel, string | undefined]> = [
      [NotificationChannel.EMAIL, contact.email],
      [NotificationChannel.SMS, contact.phone],
      [NotificationChannel.WHATSAPP, contact.phone],
    ];
    return candidates
      .filter(
        (item): item is [NotificationChannel, string] =>
          Boolean(item[1]) && this.sender.supports(item[0]),
      )
      .map(([channel, recipient]) => ({ channel, recipient, subject, text }));
  }

  private contact(value: Prisma.JsonValue): AddressContact {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    const object = value as Record<string, Prisma.JsonValue>;
    return {
      email: typeof object.email === 'string' ? object.email : undefined,
      phone: typeof object.phone === 'string' ? object.phone : undefined,
      recipientName: typeof object.recipientName === 'string' ? object.recipientName : undefined,
    };
  }

  private retryDelay(attempt: number): number {
    return Math.min(2 ** attempt * 1000, 15 * 60 * 1000);
  }
}
