import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PaymentQueueService } from './payment-queue.service';
import { RazorpayService } from './razorpay.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly queue: PaymentQueueService,
  ) {}

  async ingest(rawBody: Buffer, signature: string, providerEventId: string): Promise<void> {
    if (!this.razorpay.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('Rejected Razorpay webhook with an invalid signature');
      throw new UnauthorizedException('Invalid Razorpay webhook signature');
    }
    const payload = this.parse(rawBody);
    const eventType = typeof payload.event === 'string' ? payload.event : '';
    if (!eventType) {
      throw new UnauthorizedException('Invalid Razorpay webhook payload');
    }

    const existing = await this.prisma.webhookEvent.findUnique({
      where: { providerEventId },
      select: { id: true, status: true },
    });
    if (existing) {
      if (existing.status === 'RECEIVED' || existing.status === 'FAILED') {
        await this.queue.enqueueWebhook(existing.id);
      }
      return;
    }
    try {
      const event = await this.prisma.webhookEvent.create({
        data: {
          providerEventId,
          eventType,
          payload: payload as Prisma.InputJsonObject,
        },
      });
      await this.queue.enqueueWebhook(event.id);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const racedEvent = await this.prisma.webhookEvent.findUnique({
          where: { providerEventId },
          select: { id: true, status: true },
        });
        if (racedEvent && (racedEvent.status === 'RECEIVED' || racedEvent.status === 'FAILED')) {
          await this.queue.enqueueWebhook(racedEvent.id);
        }
        return;
      }
      throw error;
    }
  }

  private parse(rawBody: Buffer): Record<string, unknown> {
    try {
      const value = JSON.parse(rawBody.toString('utf8')) as unknown;
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('not an object');
      }
      return value as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException('Invalid Razorpay webhook payload');
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
