import { ConfigService } from '@nestjs/config';
import { Order, OrderStatus, PaymentProvider } from '@prisma/client';
import { FssCodec } from './fss-codec';
import { FssGatewayService } from './fss-gateway.service';

describe('FssGatewayService', () => {
  const resourceKey = 'k'.repeat(32);
  const codec = new FssCodec(resourceKey);
  const environment: Record<string, unknown> = {
    FSS_ENABLED: true,
    FSS_MERCHANT_ID: 'TP0001',
    FSS_MERCHANT_PASSWORD: 'tp-secret',
    FSS_RESOURCE_KEY: resourceKey,
    FSS_PAYMENT_URL: 'https://test-gateway.example.bank/PGServlet',
    FSS_RESPONSE_MODE: 'redirect-body',
    FSS_CURRENCY_CODE: '356',
    FSS_LANGUAGE_ID: 'USA',
    API_PUBLIC_URL: 'https://www.glockery.com/',
    OUTBOUND_TIMEOUT_MS: 5_000,
  };
  const order = {
    id: '1b4e28ba-2fa1-11d2-883f-0016d3cca427',
    orderNumber: 'GHC-TEST-1',
    status: OrderStatus.PAYMENT_PENDING,
    currency: 'INR',
    totalPaise: 12_750,
    paymentProvider: PaymentProvider.FSS,
    providerOrderClaimedAt: null,
    razorpayOrderId: null,
    fssTrackId: '1758000000000123456',
  } as Order;

  const configFor = (overrides: Record<string, unknown> = {}): ConfigService => {
    const values = { ...environment, ...overrides };
    return {
      get: jest.fn((key: string) => values[key]),
      getOrThrow: jest.fn((key: string) => {
        if (values[key] === undefined) throw new Error(`missing ${key}`);
        return values[key];
      }),
    } as unknown as ConfigService;
  };

  it('builds an encrypted purchase request for the hosted payment page', () => {
    const service = new FssGatewayService(configFor());

    const request = service.buildPaymentRequest(order);

    expect(request).toMatchObject({
      url: environment.FSS_PAYMENT_URL,
      method: 'POST',
      fields: {
        tranportalId: 'TP0001',
        responseURL: 'https://www.glockery.com/api/v1/payments/fss/response',
        errorURL: 'https://www.glockery.com/api/v1/payments/fss/error',
      },
    });
    expect(codec.decrypt(request.fields.trandata)).toEqual({
      id: 'TP0001',
      password: 'tp-secret',
      action: '1',
      langid: 'USA',
      currencycode: '356',
      amt: '127.50',
      responseURL: 'https://www.glockery.com/api/v1/payments/fss/response',
      errorURL: 'https://www.glockery.com/api/v1/payments/fss/error',
      trackid: order.fssTrackId,
      udf1: order.orderNumber,
      udf2: order.id,
    });
  });

  it('prefers explicitly configured response and error URLs', () => {
    const service = new FssGatewayService(
      configFor({
        FSS_RESPONSE_URL: 'https://api.glockery.com/api/v1/payments/fss/response',
        FSS_ERROR_URL: 'https://api.glockery.com/api/v1/payments/fss/error',
      }),
    );

    expect(service.buildPaymentRequest(order).fields).toMatchObject({
      responseURL: 'https://api.glockery.com/api/v1/payments/fss/response',
      errorURL: 'https://api.glockery.com/api/v1/payments/fss/error',
    });
  });

  it('refuses to build requests when the gateway is not configured', () => {
    const service = new FssGatewayService(configFor({ FSS_ENABLED: false }));
    expect(service.isEnabled()).toBe(false);
    expect(() => service.buildPaymentRequest(order)).toThrow('not configured');
  });

  it('decrypts an encrypted callback and marks it verified', () => {
    const service = new FssGatewayService(configFor());
    const trandata = codec.encrypt({
      paymentid: 'PAY-1',
      tranid: 'TRAN-1',
      trackid: order.fssTrackId!,
      result: 'CAPTURED',
      auth: '123456',
      ref: 'RRN-1',
      amt: '127.50',
      paymentmethod: 'UPI',
    });

    const result = service.parseResponse({ trandata, tranportalId: 'TP0001' });

    expect(result).toMatchObject({
      trackId: order.fssTrackId,
      paymentId: 'PAY-1',
      transactionId: 'TRAN-1',
      reference: 'RRN-1',
      authCode: '123456',
      result: 'CAPTURED',
      outcome: 'captured',
      amountPaise: 12_750,
      paymentMethod: 'UPI',
      verified: true,
    });
  });

  it('parses a plaintext callback but leaves it unverified', () => {
    const service = new FssGatewayService(configFor());

    const result = service.parseResponse({
      trackid: order.fssTrackId,
      result: 'NOT CAPTURED',
      paymentid: 'PAY-2',
      amt: '127.50',
      ErrorText: 'Insufficient funds',
    });

    expect(result).toMatchObject({
      outcome: 'failed',
      verified: false,
      errorText: 'Insufficient funds',
      paymentId: 'PAY-2',
    });
  });

  it('treats undecryptable trandata as unverified plaintext', () => {
    const service = new FssGatewayService(configFor());
    const foreign = new FssCodec('x'.repeat(32)).encrypt({ result: 'CAPTURED' });

    const result = service.parseResponse({ trandata: foreign, trackid: order.fssTrackId });

    expect(result.verified).toBe(false);
    expect(result.outcome).toBe('pending');
    expect(result.trackId).toBe(order.fssTrackId);
  });

  it('classifies gateway results', () => {
    const outcome = (fields: Record<string, string>): string =>
      FssGatewayService.normalize(fields, true).outcome;

    expect(outcome({ result: 'CAPTURED' })).toBe('captured');
    expect(outcome({ result: 'captured' })).toBe('captured');
    expect(outcome({ result: 'NOT CAPTURED' })).toBe('failed');
    expect(outcome({ result: 'CANCELED' })).toBe('failed');
    expect(outcome({ result: 'DENIED BY RISK' })).toBe('failed');
    expect(outcome({ result: 'HOST TIMEOUT' })).toBe('pending');
    expect(outcome({})).toBe('pending');
    expect(outcome({ Error: 'IPAY0100001', ErrorText: 'Invalid merchant' })).toBe('failed');
  });

  it('converts amounts between paise and rupee strings', () => {
    expect(FssGatewayService.rupees(12_750)).toBe('127.50');
    expect(FssGatewayService.rupees(100)).toBe('1.00');
    expect(FssGatewayService.paise('127.50')).toBe(12_750);
    expect(FssGatewayService.paise('1,127.5')).toBe(112_750);
    expect(FssGatewayService.paise('abc')).toBeNull();
    expect(FssGatewayService.paise(undefined)).toBeNull();
  });

  it('performs an inquiry against the gateway and trusts the direct answer', async () => {
    const service = new FssGatewayService(configFor());
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        codec.encrypt({
          trackid: order.fssTrackId!,
          result: 'CAPTURED',
          paymentid: 'PAY-9',
          amt: '127.50',
        }),
        { status: 200 },
      ),
    );

    try {
      const result = await service.inquire(order);

      expect(result).toMatchObject({ outcome: 'captured', paymentId: 'PAY-9', verified: true });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(environment.FSS_PAYMENT_URL);
      const sent = new URLSearchParams(init.body as string);
      expect(sent.get('tranportalId')).toBe('TP0001');
      expect(codec.decrypt(sent.get('trandata')!)).toMatchObject({
        action: '8',
        trackid: order.fssTrackId,
        amt: '127.50',
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('wraps gateway inquiry failures as bad gateway errors', async () => {
    const service = new FssGatewayService(configFor());
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('down', { status: 503 }));

    try {
      await expect(service.inquire(order)).rejects.toThrow('HTTP 503');
    } finally {
      fetchMock.mockRestore();
    }
  });
});
