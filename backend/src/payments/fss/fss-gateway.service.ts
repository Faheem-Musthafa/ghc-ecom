import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Order } from '@prisma/client';
import { FssCodec } from './fss-codec';

const DEFAULT_OUTBOUND_TIMEOUT_MS = 10_000;

/** Gateway actions defined by the FSS IPay tranportal interface. */
const FSS_ACTION = { PURCHASE: '1', INQUIRY: '8' } as const;

/**
 * Field names exchanged with the gateway. They follow the FSS IPay kit shared
 * by most Indian banks; adjust here if the bank's TEST KIT differs.
 */
const REQUEST_FIELD = {
  merchantId: 'id',
  password: 'password',
  action: 'action',
  languageId: 'langid',
  currencyCode: 'currencycode',
  amount: 'amt',
  responseUrl: 'responseURL',
  errorUrl: 'errorURL',
  trackId: 'trackid',
  transactionId: 'transid',
  udf1: 'udf1',
  udf2: 'udf2',
  udf3: 'udf3',
  udf4: 'udf4',
  udf5: 'udf5',
} as const;

const RESPONSE_FIELD = {
  trandata: 'trandata',
  paymentId: 'paymentid',
  transactionId: 'tranid',
  trackId: 'trackid',
  result: 'result',
  authCode: 'auth',
  reference: 'ref',
  amount: 'amt',
  responseCode: 'responsecode',
  error: 'Error',
  errorText: 'ErrorText',
  paymentMethod: 'paymentmethod',
} as const;

const CAPTURED_RESULTS = new Set(['CAPTURED', 'SUCCESS', 'APPROVED']);
const PENDING_RESULTS = new Set(['PENDING', 'HOST TIMEOUT', 'INITIATED']);

export type FssOutcome = 'captured' | 'failed' | 'pending';

export interface FssGatewayResult {
  trackId: string | null;
  /** Gateway payment identifier; used as the unique local payment reference. */
  paymentId: string | null;
  transactionId: string | null;
  reference: string | null;
  authCode: string | null;
  result: string;
  outcome: FssOutcome;
  amountPaise: number | null;
  paymentMethod: string | null;
  errorText: string | null;
  /** True when the payload was decrypted with the shared resource key. */
  verified: boolean;
  raw: Record<string, string>;
}

export interface FssPaymentRequest {
  url: string;
  method: 'POST';
  fields: Record<string, string>;
}

@Injectable()
export class FssGatewayService {
  private readonly logger = new Logger(FssGatewayService.name);
  private readonly enabled: boolean;
  private readonly merchantId?: string;
  private readonly password?: string;
  private readonly paymentUrl?: string;
  private readonly responseUrl: string;
  private readonly errorUrl: string;
  private readonly currencyCode: string;
  private readonly languageId: string;
  private readonly responseMode: 'redirect-body' | 'http-redirect';
  private readonly timeoutMs: number;
  private codec?: FssCodec;

  constructor(config: ConfigService) {
    this.enabled = config.get<boolean>('FSS_ENABLED') ?? false;
    this.merchantId = config.get<string>('FSS_MERCHANT_ID');
    this.password = config.get<string>('FSS_MERCHANT_PASSWORD');
    this.paymentUrl = config.get<string>('FSS_PAYMENT_URL');
    const apiPublicUrl = config.getOrThrow<string>('API_PUBLIC_URL').replace(/\/+$/, '');
    this.responseUrl =
      config.get<string>('FSS_RESPONSE_URL') ?? `${apiPublicUrl}/api/v1/payments/fss/response`;
    this.errorUrl =
      config.get<string>('FSS_ERROR_URL') ?? `${apiPublicUrl}/api/v1/payments/fss/error`;
    this.currencyCode = config.get<string>('FSS_CURRENCY_CODE') ?? '356';
    this.languageId = config.get<string>('FSS_LANGUAGE_ID') ?? 'USA';
    this.responseMode = config.get('FSS_RESPONSE_MODE') ?? 'redirect-body';
    this.timeoutMs = config.get<number>('OUTBOUND_TIMEOUT_MS') ?? DEFAULT_OUTBOUND_TIMEOUT_MS;
    const resourceKey = config.get<string>('FSS_RESOURCE_KEY');
    if (resourceKey) {
      this.codec = new FssCodec(resourceKey);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  usesHttpRedirect(): boolean {
    return this.responseMode === 'http-redirect';
  }

  /** Form the browser must POST to the bank to open the hosted payment page. */
  buildPaymentRequest(order: Order): FssPaymentRequest {
    const { merchantId, password, paymentUrl, codec } = this.requireConfiguration();
    if (!order.fssTrackId) {
      throw new Error('Order has no FSS track ID');
    }
    const trandata = codec.encrypt({
      [REQUEST_FIELD.merchantId]: merchantId,
      [REQUEST_FIELD.password]: password,
      [REQUEST_FIELD.action]: FSS_ACTION.PURCHASE,
      [REQUEST_FIELD.languageId]: this.languageId,
      [REQUEST_FIELD.currencyCode]: this.currencyCode,
      [REQUEST_FIELD.amount]: FssGatewayService.rupees(order.totalPaise),
      [REQUEST_FIELD.responseUrl]: this.responseUrl,
      [REQUEST_FIELD.errorUrl]: this.errorUrl,
      [REQUEST_FIELD.trackId]: order.fssTrackId,
      [REQUEST_FIELD.udf1]: order.orderNumber,
      [REQUEST_FIELD.udf2]: order.id,
    });
    return {
      url: paymentUrl,
      method: 'POST',
      fields: {
        tranportalId: merchantId,
        responseURL: this.responseUrl,
        errorURL: this.errorUrl,
        trandata,
      },
    };
  }

  /**
   * Normalises the gateway callback body. Encrypted `trandata` is authoritative;
   * a plaintext body is parsed but flagged unverified so callers can fall back to
   * a server-to-server inquiry before trusting it.
   */
  parseResponse(body: Record<string, unknown>): FssGatewayResult {
    const plain = FssGatewayService.stringFields(body);
    const trandata = plain[RESPONSE_FIELD.trandata];
    let fields = plain;
    let verified = false;
    if (trandata) {
      const { codec } = this.requireConfiguration();
      try {
        fields = { ...plain, ...codec.decrypt(trandata) };
        verified = true;
      } catch (error) {
        this.logger.warn(
          `FSS trandata could not be decrypted: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    return FssGatewayService.normalize(fields, verified);
  }

  /** Server-to-server status check for a track ID (FSS action 8). */
  async inquire(order: Order): Promise<FssGatewayResult> {
    const { merchantId, password, paymentUrl, codec } = this.requireConfiguration();
    if (!order.fssTrackId) {
      throw new Error('Order has no FSS track ID');
    }
    const trandata = codec.encrypt({
      [REQUEST_FIELD.merchantId]: merchantId,
      [REQUEST_FIELD.password]: password,
      [REQUEST_FIELD.action]: FSS_ACTION.INQUIRY,
      [REQUEST_FIELD.amount]: FssGatewayService.rupees(order.totalPaise),
      [REQUEST_FIELD.trackId]: order.fssTrackId,
      [REQUEST_FIELD.udf5]: 'TrackID',
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(paymentUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ tranportalId: merchantId, trandata }).toString(),
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        throw new BadGatewayException(`FSS inquiry failed with HTTP ${response.status}`);
      }
      return this.parseInquiryBody(text);
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(
        `FSS inquiry request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private parseInquiryBody(text: string): FssGatewayResult {
    const trimmed = text.trim();
    // The gateway answers either with a bare hex trandata blob or a urlencoded body.
    const body: Record<string, unknown> = /^[0-9a-f]+$/i.test(trimmed)
      ? { [RESPONSE_FIELD.trandata]: trimmed }
      : FssCodec.parse(trimmed);
    // The inquiry answer arrives over our own TLS connection to the bank, so it is
    // trustworthy even when the gateway replies in plaintext.
    return { ...this.parseResponse(body), verified: true };
  }

  private requireConfiguration(): {
    merchantId: string;
    password: string;
    paymentUrl: string;
    codec: FssCodec;
  } {
    if (!this.enabled || !this.merchantId || !this.password || !this.paymentUrl || !this.codec) {
      throw new Error('FSS gateway is not configured; set FSS_ENABLED=true and FSS_* variables');
    }
    return {
      merchantId: this.merchantId,
      password: this.password,
      paymentUrl: this.paymentUrl,
      codec: this.codec,
    };
  }

  static normalize(fields: Record<string, string>, verified: boolean): FssGatewayResult {
    const result = (fields[RESPONSE_FIELD.result] ?? '').trim().toUpperCase();
    const hasGatewayError = Boolean(
      fields[RESPONSE_FIELD.error] || fields[RESPONSE_FIELD.errorText],
    );
    const outcome: FssOutcome = CAPTURED_RESULTS.has(result)
      ? 'captured'
      : !result && !hasGatewayError
        ? 'pending'
        : PENDING_RESULTS.has(result)
          ? 'pending'
          : 'failed';
    const paymentId = fields[RESPONSE_FIELD.paymentId] || fields[RESPONSE_FIELD.transactionId];
    return {
      trackId: fields[RESPONSE_FIELD.trackId] || null,
      paymentId: paymentId || null,
      transactionId: fields[RESPONSE_FIELD.transactionId] || null,
      reference: fields[RESPONSE_FIELD.reference] || null,
      authCode: fields[RESPONSE_FIELD.authCode] || null,
      result: result || (hasGatewayError ? 'ERROR' : ''),
      outcome,
      amountPaise: FssGatewayService.paise(fields[RESPONSE_FIELD.amount]),
      paymentMethod: fields[RESPONSE_FIELD.paymentMethod] || null,
      errorText: fields[RESPONSE_FIELD.errorText] || fields[RESPONSE_FIELD.error] || null,
      verified,
      raw: fields,
    };
  }

  static rupees(paise: number): string {
    return (paise / 100).toFixed(2);
  }

  static paise(amount: string | undefined): number | null {
    if (!amount) return null;
    const value = Number.parseFloat(amount.replace(/,/g, ''));
    return Number.isFinite(value) ? Math.round(value * 100) : null;
  }

  private static stringFields(body: Record<string, unknown>): Record<string, string> {
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') fields[key] = value;
      else if (Array.isArray(value) && typeof value[0] === 'string') fields[key] = value[0];
    }
    return fields;
  }
}
