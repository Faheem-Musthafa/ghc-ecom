import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Order, OrderStatus, PaymentProvider, PaymentStatus, QuoteStatus } from '@prisma/client';
import { CartService } from '../../cart/cart.service';
import { PrismaService } from '../../database/prisma.service';
import { FssGatewayResult, FssGatewayService } from './fss-gateway.service';
import { FssPaymentsService } from './fss-payments.service';

describe('FssPaymentsService', () => {
  const quote = {
    id: '0f8fad5b-d9cb-469f-a165-70867728950e',
    cartId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    userId: null,
    couponId: null,
    status: QuoteStatus.ACTIVE,
    currency: 'INR',
    itemsSnapshot: [{ sku: 'SKU-1', quantity: 1 }],
    addressSnapshot: { city: 'Pune' },
    subtotalPaise: 10_000,
    discountPaise: 0,
    shippingPaise: 900,
    taxPaise: 1_800,
    totalPaise: 12_700,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
  };
  const pendingOrder = {
    id: '1b4e28ba-2fa1-11d2-883f-0016d3cca427',
    orderNumber: 'GHC-TEST-1',
    quoteId: quote.id,
    cartId: quote.cartId,
    userId: null,
    couponId: null,
    status: OrderStatus.PAYMENT_PENDING,
    currency: 'INR',
    itemsSnapshot: quote.itemsSnapshot,
    addressSnapshot: quote.addressSnapshot,
    subtotalPaise: quote.subtotalPaise,
    discountPaise: quote.discountPaise,
    shippingPaise: quote.shippingPaise,
    taxPaise: quote.taxPaise,
    totalPaise: quote.totalPaise,
    paymentProvider: PaymentProvider.FSS,
    providerOrderClaimedAt: null,
    razorpayOrderId: null,
    fssTrackId: '1758000000000123456',
    paymentExpiresAt: quote.expiresAt,
    confirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Order;
  const captured: FssGatewayResult = {
    trackId: pendingOrder.fssTrackId,
    paymentId: 'PAY-1',
    transactionId: 'TRAN-1',
    reference: 'RRN-1',
    authCode: '123456',
    result: 'CAPTURED',
    outcome: 'captured',
    amountPaise: pendingOrder.totalPaise,
    paymentMethod: 'UPI',
    errorText: null,
    verified: true,
    raw: { result: 'CAPTURED' },
  };
  const gatewayRequest = {
    url: 'https://test-gateway.example.bank/PGServlet',
    method: 'POST' as const,
    fields: { tranportalId: 'TP0001', trandata: 'abcd' },
  };

  let orderById: Order | null;
  let orderByTrack: Order | null;
  let existingByQuote: Order | null;
  let prisma: {
    checkoutQuote: { findUnique: jest.Mock };
    order: { findUnique: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let transaction: {
    $executeRaw: jest.Mock;
    order: { findUnique: jest.Mock; create: jest.Mock };
    payment: { findUnique: jest.Mock; upsert: jest.Mock };
  };
  let carts: { requireAccessibleCart: jest.Mock; requireOwnedCart: jest.Mock };
  let gateway: {
    isEnabled: jest.Mock;
    buildPaymentRequest: jest.Mock;
    parseResponse: jest.Mock;
    inquire: jest.Mock;
  };
  let service: FssPaymentsService;

  const sqlCalls = (): string[] =>
    transaction.$executeRaw.mock.calls.map((call: [TemplateStringsArray]) => call[0].join(''));

  beforeEach(() => {
    orderById = pendingOrder;
    orderByTrack = pendingOrder;
    existingByQuote = null;
    transaction = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      order: {
        findUnique: jest.fn(() => Promise.resolve(existingByQuote)),
        create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...pendingOrder, ...data }),
        ),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    prisma = {
      checkoutQuote: { findUnique: jest.fn().mockResolvedValue(quote) },
      order: {
        findUnique: jest.fn(({ where }: { where: { id?: string; fssTrackId?: string } }) =>
          Promise.resolve(where.fssTrackId ? orderByTrack : orderById),
        ),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    carts = {
      requireAccessibleCart: jest.fn().mockResolvedValue({ id: quote.cartId }),
      requireOwnedCart: jest.fn().mockResolvedValue({ id: quote.cartId }),
    };
    gateway = {
      isEnabled: jest.fn().mockReturnValue(true),
      buildPaymentRequest: jest.fn().mockReturnValue(gatewayRequest),
      parseResponse: jest.fn().mockReturnValue(captured),
      inquire: jest.fn().mockResolvedValue(captured),
    };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('https://www.glockery.com'),
    } as unknown as ConfigService;
    service = new FssPaymentsService(
      prisma as unknown as PrismaService,
      carts as unknown as CartService,
      gateway as unknown as FssGatewayService,
      config,
    );
  });

  describe('createIntent', () => {
    it('creates a pending FSS order with a numeric track id and returns the gateway form', async () => {
      const intent = await service.createIntent({ quoteId: quote.id }, undefined, 'guest-token');

      expect(carts.requireAccessibleCart).toHaveBeenCalledWith(
        quote.cartId,
        undefined,
        'guest-token',
      );
      const created = transaction.order.create.mock.calls[0][0].data as Record<string, unknown>;
      expect(created).toMatchObject({
        quoteId: quote.id,
        paymentProvider: PaymentProvider.FSS,
        totalPaise: quote.totalPaise,
      });
      expect(created.fssTrackId).toMatch(/^\d{16,20}$/);
      expect(intent.orderNumber).toMatch(/^GHC-/);
      expect(intent).toMatchObject({
        provider: 'fss',
        amount: quote.totalPaise,
        currency: 'INR',
        gateway: gatewayRequest,
      });
      expect(gateway.buildPaymentRequest).toHaveBeenCalledWith(
        expect.objectContaining({ fssTrackId: created.fssTrackId }),
      );
    });

    it('reuses an existing FSS order for the same quote', async () => {
      existingByQuote = pendingOrder;

      const intent = await service.createIntent({ quoteId: quote.id });

      expect(transaction.order.create).not.toHaveBeenCalled();
      expect(intent.orderId).toBe(pendingOrder.id);
    });

    it('rejects a quote whose order belongs to another gateway', async () => {
      existingByQuote = {
        ...pendingOrder,
        paymentProvider: PaymentProvider.RAZORPAY,
        fssTrackId: null,
      };

      await expect(service.createIntent({ quoteId: quote.id })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('is unavailable while the gateway is disabled', async () => {
      gateway.isEnabled.mockReturnValue(false);

      await expect(service.createIntent({ quoteId: quote.id })).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(prisma.checkoutQuote.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('handleGatewayResponse', () => {
    it('confirms the order from a verified captured callback', async () => {
      const redirect = await service.handleGatewayResponse({ trandata: 'x' });

      expect(transaction.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fssTransactionId: 'PAY-1' },
          create: expect.objectContaining({
            orderId: pendingOrder.id,
            provider: PaymentProvider.FSS,
            status: PaymentStatus.CAPTURED,
            amountPaise: pendingOrder.totalPaise,
            signatureVerified: true,
            method: 'UPI',
          }),
        }),
      );
      expect(sqlCalls()[0]).toContain('confirm_paid_order');
      expect(redirect).toContain(`https://www.glockery.com/checkout/result?outcome=`);
      expect(redirect).toContain(`order=${pendingOrder.id}`);
    });

    it('reports success once the order is confirmed', async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce(pendingOrder)
        .mockResolvedValueOnce({ ...pendingOrder, status: OrderStatus.CONFIRMED });

      const redirect = await service.handleGatewayResponse({ trandata: 'x' });

      expect(redirect).toContain('outcome=success');
    });

    it('fails the order from a verified failed callback', async () => {
      gateway.parseResponse.mockReturnValue({
        ...captured,
        result: 'NOT CAPTURED',
        outcome: 'failed',
        paymentId: 'PAY-2',
      });
      prisma.order.findUnique
        .mockResolvedValueOnce(pendingOrder)
        .mockResolvedValueOnce({ ...pendingOrder, status: OrderStatus.PAYMENT_FAILED });

      const redirect = await service.handleGatewayResponse({});

      expect(transaction.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fssTransactionId: 'PAY-2' },
          create: expect.objectContaining({ status: PaymentStatus.FAILED }),
        }),
      );
      expect(sqlCalls()[0]).toContain('fail_pending_order');
      expect(redirect).toContain('outcome=failed');
    });

    it('does not create a payment row for a failure without a gateway id', async () => {
      gateway.parseResponse.mockReturnValue({
        ...captured,
        outcome: 'failed',
        paymentId: null,
        transactionId: null,
      });

      await service.handleGatewayResponse({});

      expect(transaction.payment.upsert).not.toHaveBeenCalled();
      expect(sqlCalls()[0]).toContain('fail_pending_order');
    });

    it('runs a server-side inquiry before trusting a plaintext callback', async () => {
      gateway.parseResponse.mockReturnValue({ ...captured, verified: false });

      await service.handleGatewayResponse({ result: 'CAPTURED' });

      expect(gateway.inquire).toHaveBeenCalledWith(pendingOrder);
      expect(sqlCalls()[0]).toContain('confirm_paid_order');
    });

    it('leaves the order pending when the inquiry cannot be completed', async () => {
      gateway.parseResponse.mockReturnValue({ ...captured, verified: false });
      gateway.inquire.mockRejectedValue(new Error('gateway down'));

      const redirect = await service.handleGatewayResponse({ result: 'CAPTURED' });

      expect(transaction.$executeRaw).not.toHaveBeenCalled();
      expect(redirect).toContain('outcome=pending');
    });

    it('refuses to confirm when the captured amount differs from the order', async () => {
      gateway.parseResponse.mockReturnValue({ ...captured, amountPaise: 100 });

      const redirect = await service.handleGatewayResponse({});

      expect(transaction.payment.upsert).not.toHaveBeenCalled();
      expect(transaction.$executeRaw).not.toHaveBeenCalled();
      expect(redirect).toContain('outcome=pending');
    });

    it('refuses to link a gateway payment already attached to another order', async () => {
      transaction.payment.findUnique.mockResolvedValue({ orderId: 'another-order' });

      const redirect = await service.handleGatewayResponse({});

      expect(transaction.payment.upsert).not.toHaveBeenCalled();
      expect(redirect).toContain('outcome=pending');
    });

    it('records a verified capture that arrives after the order already failed', async () => {
      orderByTrack = { ...pendingOrder, status: OrderStatus.PAYMENT_FAILED };

      const redirect = await service.handleGatewayResponse({ trandata: 'x' });

      expect(transaction.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fssTransactionId: 'PAY-1' },
          create: expect.objectContaining({ status: PaymentStatus.CAPTURED }),
        }),
      );
      expect(transaction.$executeRaw).not.toHaveBeenCalled();
      expect(redirect).toContain('outcome=failed');
    });

    it('ignores unverified captures for orders that already left pending state', async () => {
      orderByTrack = { ...pendingOrder, status: OrderStatus.PAYMENT_FAILED };
      gateway.parseResponse.mockReturnValue({ ...captured, verified: false });

      await service.handleGatewayResponse({});

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(gateway.inquire).not.toHaveBeenCalled();
    });

    it('is idempotent for callbacks on an order that already left pending state', async () => {
      orderByTrack = { ...pendingOrder, status: OrderStatus.CONFIRMED };

      const redirect = await service.handleGatewayResponse({});

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(redirect).toContain('outcome=success');
    });

    it('sends the customer to a generic failure page for unknown track ids', async () => {
      orderByTrack = null;

      const redirect = await service.handleGatewayResponse({});

      expect(redirect).toBe('https://www.glockery.com/checkout/result?outcome=failed');
    });

    it('handles a callback without a track id', async () => {
      gateway.parseResponse.mockReturnValue({ ...captured, trackId: null });

      const redirect = await service.handleGatewayResponse({});

      expect(prisma.order.findUnique).not.toHaveBeenCalled();
      expect(redirect).toContain('outcome=failed');
    });

    it('rejects callbacks while the gateway is disabled', async () => {
      gateway.isEnabled.mockReturnValue(false);

      const redirect = await service.handleGatewayResponse({});

      expect(gateway.parseResponse).not.toHaveBeenCalled();
      expect(redirect).toContain('outcome=failed');
    });
  });

  describe('resolveStatus', () => {
    it('requires cart ownership and settles a pending order through inquiry', async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce(pendingOrder)
        .mockResolvedValueOnce({ ...pendingOrder, status: OrderStatus.CONFIRMED });

      const order = await service.resolveStatus(pendingOrder.id, 'Bearer token', undefined);

      expect(carts.requireOwnedCart).toHaveBeenCalledWith(quote.cartId, 'Bearer token', undefined);
      expect(gateway.inquire).toHaveBeenCalledWith(pendingOrder);
      expect(order.status).toBe(OrderStatus.CONFIRMED);
    });

    it('fails an expired order when the gateway still reports it pending', async () => {
      const expired = { ...pendingOrder, paymentExpiresAt: new Date(Date.now() - 1_000) };
      prisma.order.findUnique
        .mockResolvedValueOnce(expired)
        .mockResolvedValueOnce({ ...expired, status: OrderStatus.PAYMENT_FAILED });
      gateway.inquire.mockResolvedValue({ ...captured, outcome: 'pending', paymentId: null });

      await service.resolveStatus(pendingOrder.id);

      expect(sqlCalls()[0]).toContain('fail_pending_order');
    });

    it('returns non-pending orders without contacting the gateway', async () => {
      orderById = { ...pendingOrder, status: OrderStatus.CONFIRMED };

      const order = await service.resolveStatus(pendingOrder.id);

      expect(gateway.inquire).not.toHaveBeenCalled();
      expect(order.status).toBe(OrderStatus.CONFIRMED);
    });

    it('hides orders that belong to another gateway', async () => {
      orderById = { ...pendingOrder, paymentProvider: PaymentProvider.RAZORPAY };

      await expect(service.resolveStatus(pendingOrder.id)).rejects.toThrow('Order not found');
    });
  });

  describe('reconcilePending', () => {
    it('settles each pending FSS order and counts the outcome', async () => {
      const failing = { ...pendingOrder, id: 'order-2', fssTrackId: '2' };
      const stuck = { ...pendingOrder, id: 'order-3', fssTrackId: '3' };
      prisma.order.findMany.mockResolvedValue([pendingOrder, failing, stuck]);
      gateway.inquire
        .mockResolvedValueOnce(captured)
        .mockResolvedValueOnce({ ...captured, outcome: 'failed', paymentId: 'PAY-F' })
        .mockResolvedValueOnce({ ...captured, outcome: 'pending', paymentId: null });

      const result = await service.reconcilePending(10);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ paymentProvider: PaymentProvider.FSS }),
          take: 10,
        }),
      );
      expect(result).toEqual({ inspected: 3, confirmed: 1, failed: 1, pending: 1, errors: 0 });
    });

    it('counts gateway errors without aborting the batch', async () => {
      prisma.order.findMany.mockResolvedValue([pendingOrder]);
      gateway.inquire.mockRejectedValue(new Error('down'));

      expect(await service.reconcilePending()).toMatchObject({ inspected: 1, errors: 1 });
    });

    it('does nothing while the gateway is disabled', async () => {
      gateway.isEnabled.mockReturnValue(false);

      expect(await service.reconcilePending()).toEqual({
        inspected: 0,
        confirmed: 0,
        failed: 0,
        pending: 0,
        errors: 0,
      });
      expect(prisma.order.findMany).not.toHaveBeenCalled();
    });
  });
});
