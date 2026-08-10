import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@prisma/client';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

export interface NotificationMessage {
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
}

@Injectable()
export class NotificationSenderService {
  private readonly emailFrom: string;
  private readonly resendApiKey: string;
  private readonly webhookUrl?: string;
  private readonly webhookToken?: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.emailFrom = config.getOrThrow<string>('EMAIL_FROM');
    this.resendApiKey = config.getOrThrow<string>('RESEND_API_KEY');
    this.webhookUrl = config.get<string>('NOTIFICATION_WEBHOOK_URL');
    this.webhookToken = config.get<string>('NOTIFICATION_WEBHOOK_TOKEN');
    this.timeoutMs = config.get<number>('OUTBOUND_TIMEOUT_MS') ?? 10_000;
  }

  supports(channel: NotificationChannel): boolean {
    return channel === NotificationChannel.EMAIL || Boolean(this.webhookUrl);
  }

  async send(message: NotificationMessage): Promise<string> {
    if (message.channel === NotificationChannel.EMAIL) {
      return this.sendEmail(message);
    }
    if (!this.webhookUrl) {
      throw new BadGatewayException(`${message.channel} notification provider is not configured`);
    }
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: {
        'content-type': 'application/json',
        ...(this.webhookToken ? { authorization: `Bearer ${this.webhookToken}` } : {}),
      },
      body: JSON.stringify(message),
    });
    if (!response.ok) {
      throw new BadGatewayException(
        `${message.channel} notification provider returned ${response.status}`,
      );
    }
    const body = (await response.json()) as { id?: string };
    return body.id ?? `${message.channel.toLowerCase()}-${Date.now()}`;
  }

  private async sendEmail(message: NotificationMessage): Promise<string> {
    const response = await fetch(RESEND_EMAILS_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: {
        authorization: `Bearer ${this.resendApiKey}`,
        'content-type': 'application/json',
        ...(message.idempotencyKey ? { 'idempotency-key': message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: this.emailFrom,
        to: [message.recipient],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
    });
    if (!response.ok) {
      throw new BadGatewayException(
        `${message.channel} notification provider returned ${response.status}`,
      );
    }
    const body = (await response.json()) as { id?: string };
    if (!body.id) {
      throw new BadGatewayException(`${message.channel} notification provider returned no id`);
    }
    return body.id;
  }
}
