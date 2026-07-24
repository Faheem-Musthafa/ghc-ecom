import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@prisma/client';
import nodemailer, { Transporter } from 'nodemailer';

export interface NotificationMessage {
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  text: string;
}

@Injectable()
export class NotificationSenderService {
  private readonly mailer: Transporter;
  private readonly emailFrom: string;
  private readonly webhookUrl?: string;
  private readonly webhookToken?: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.emailFrom = config.getOrThrow<string>('EMAIL_FROM');
    this.webhookUrl = config.get<string>('NOTIFICATION_WEBHOOK_URL');
    this.webhookToken = config.get<string>('NOTIFICATION_WEBHOOK_TOKEN');
    this.timeoutMs = config.get<number>('OUTBOUND_TIMEOUT_MS') ?? 10_000;
    this.mailer = nodemailer.createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: config.getOrThrow<number>('SMTP_PORT'),
      secure: config.getOrThrow<number>('SMTP_PORT') === 465,
      auth: {
        user: config.getOrThrow<string>('SMTP_USER'),
        pass: config.getOrThrow<string>('SMTP_PASSWORD'),
      },
      connectionTimeout: this.timeoutMs,
      greetingTimeout: this.timeoutMs,
      socketTimeout: this.timeoutMs,
    });
  }

  supports(channel: NotificationChannel): boolean {
    return channel === NotificationChannel.EMAIL || Boolean(this.webhookUrl);
  }

  async send(message: NotificationMessage): Promise<string> {
    if (message.channel === NotificationChannel.EMAIL) {
      const result = await this.mailer.sendMail({
        from: this.emailFrom,
        to: message.recipient,
        subject: message.subject,
        text: message.text,
      });
      return result.messageId;
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
}
