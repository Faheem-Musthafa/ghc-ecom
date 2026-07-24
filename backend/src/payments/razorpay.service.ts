import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const RAZORPAY_API_URL = 'https://api.razorpay.com/v1';
const DEFAULT_OUTBOUND_TIMEOUT_MS = 10_000;

export interface RazorpayOrder {
  id: string;
  entity: 'order';
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  status: 'created' | 'attempted' | 'paid';
  notes: Record<string, string>;
}

export interface RazorpayPayment {
  id: string;
  entity: 'payment';
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  order_id: string | null;
  method?: string;
  captured?: boolean;
  created_at?: number;
}

export interface RazorpayRefund {
  id: string;
  entity: 'refund';
  amount: number;
  currency: string;
  payment_id: string;
  status: 'pending' | 'processed' | 'failed';
  created_at?: number;
}

@Injectable()
export class RazorpayService {
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    this.keyId = config.getOrThrow<string>('RAZORPAY_KEY_ID');
    this.keySecret = config.getOrThrow<string>('RAZORPAY_KEY_SECRET');
    this.webhookSecret = config.getOrThrow<string>('RAZORPAY_WEBHOOK_SECRET');
  }

  publicKey(): string {
    return this.keyId;
  }

  createOrder(input: {
    amount: number;
    currency: string;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<RazorpayOrder> {
    return this.request<RazorpayOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  fetchOrder(orderId: string): Promise<RazorpayOrder> {
    return this.request<RazorpayOrder>(`/orders/${encodeURIComponent(orderId)}`);
  }

  fetchPayment(paymentId: string): Promise<RazorpayPayment> {
    return this.request<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
  }

  async fetchPaymentsForOrder(orderId: string): Promise<RazorpayPayment[]> {
    const response = await this.request<{ items: RazorpayPayment[] }>(
      `/orders/${encodeURIComponent(orderId)}/payments`,
    );
    return response.items;
  }

  createRefund(
    paymentId: string,
    input: {
      amount: number;
      receipt: string;
      notes: Record<string, string>;
    },
    idempotencyKey: string,
  ): Promise<RazorpayRefund> {
    return this.request<RazorpayRefund>(`/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: 'POST',
      headers: { 'x-refund-idempotency': idempotencyKey },
      body: JSON.stringify({ ...input, speed: 'normal' }),
    });
  }

  fetchRefund(refundId: string): Promise<RazorpayRefund> {
    return this.request<RazorpayRefund>(`/refunds/${encodeURIComponent(refundId)}`);
  }

  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
    return this.verifyHmac(`${orderId}|${paymentId}`, signature, this.keySecret);
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    return this.verifyHmac(rawBody, signature, this.webhookSecret);
  }

  private verifyHmac(value: string | Buffer, suppliedSignature: string, secret: string): boolean {
    const expected = createHmac('sha256', secret).update(value).digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(suppliedSignature, 'hex');
    } catch {
      return false;
    }
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${RAZORPAY_API_URL}${path}`, {
        ...init,
        signal: AbortSignal.timeout(DEFAULT_OUTBOUND_TIMEOUT_MS),
        headers: {
          authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString(
            'base64',
          )}`,
          'content-type': 'application/json',
          ...init.headers,
        },
      });
    } catch {
      throw new BadGatewayException('Razorpay is unavailable');
    }

    if (!response.ok) {
      throw new BadGatewayException(`Razorpay request failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  }
}
