import { UnauthorizedException } from '@nestjs/common';
import { Order, OrderStatus, QuoteStatus } from '@prisma/client';
import { CartService } from '../cart/cart.service';
import { PrismaService } from '../database/prisma.service';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';

describe('PaymentsService', () => {
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
    razorpayOrderId: null,
    paymentExpiresAt: quote.expiresAt,
    confirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Order;
  let existingOrder: Order | null;
  let prisma: {
    checkoutQuote: { findUnique: jest.Mock };
    order: { findUnique: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
    $executeRaw: jest.Mock;
  };
  let transaction: {
    $executeRaw: jest.Mock;
    order: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    payment: { findUnique: jest.Mock; upsert: jest.Mock };
  };
  let carts: { requireAccessibleCart: jest.Mock; requireOwnedCart: jest.Mock };
  let razorpay: {
    publicKey: jest.Mock;
    createOrder: jest.Mock;
    verifyCheckoutSignature: jest.Mock;
    fetchPayment: jest.Mock;
    fetchOrder: jest.Mock;
    fetchPaymentsForOrder: jest.Mock;
  };
  let service: PaymentsService;

  beforeEach(() => {
    existingOrder = null;
    transaction = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      order: {
        findUnique: jest.fn(() => Promise.resolve(existingOrder)),
        create: jest.fn().mockImplementation(() => {
          existingOrder = pendingOrder;
          return Promise.resolve(pendingOrder);
        }),
        update: jest.fn().mockImplementation(() => {
          existingOrder = { ...pendingOrder, razorpayOrderId: 'order_provider_1' };
          return Promise.resolve(existingOrder);
        }),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    prisma = {
      checkoutQuote: { findUnique: jest.fn().mockResolvedValue(quote) },
      order: {
        findUnique: jest.fn().mockResolvedValue(pendingOrder),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    carts = {
      requireAccessibleCart: jest.fn().mockResolvedValue({ id: quote.cartId }),
      requireOwnedCart: jest.fn().mockResolvedValue({ id: quote.cartId }),
    };
    razorpay = {
      publicKey: jest.fn().mockReturnValue('rzp_test_public'),
      createOrder: jest.fn().mockResolvedValue({
        id: 'order_provider_1',
        entity: 'order',
        amount: quote.totalPaise,
        amount_paid: 0,
        amount_due: quote.totalPaise,
        currency: 'INR',
        receipt: 'GHC-TEST-1',
        status: 'created',
        notes: {},
      }),
      verifyCheckoutSignature: jest.fn(),
      fetchPayment: jest.fn(),
      fetchOrder: jest.fn(),
      fetchPaymentsForOrder: jest.fn(),
    };
    service = new PaymentsService(
      prisma as unknown as PrismaService,
      carts as unknown as CartService,
      razorpay as unknown as RazorpayService,
    );
  });

  it('creates and reuses one local and provider order for a quote', async () => {
    const first = await service.createIntent({ quoteId: quote.id }, undefined, 'guest-token');
    const second = await service.createIntent({ quoteId: quote.id }, undefined, 'guest-token');

    expect(first).toMatchObject({
      keyId: 'rzp_test_public',
      razorpayOrderId: 'order_provider_1',
      amount: quote.totalPaise,
      currency: 'INR',
    });
    expect(second.razorpayOrderId).toBe(first.razorpayOrderId);
    expect(transaction.order.create).toHaveBeenCalledTimes(1);
    expect(razorpay.createOrder).toHaveBeenCalledTimes(1);
    expect(razorpay.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amount: quote.totalPaise, currency: 'INR' }),
    );
  });

  it('rejects an invalid checkout signature before fetching or confirming payment', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...pendingOrder,
      razorpayOrderId: 'order_provider_1',
    });
    razorpay.verifyCheckoutSignature.mockReturnValue(false);

    await expect(
      service.verifyCheckout({
        razorpayOrderId: 'order_provider_1',
        razorpayPaymentId: 'pay_1',
        razorpaySignature: 'a'.repeat(64),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(razorpay.verifyCheckoutSignature).toHaveBeenCalledWith(
      'order_provider_1',
      'pay_1',
      'a'.repeat(64),
    );
    expect(razorpay.fetchPayment).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(carts.requireOwnedCart).toHaveBeenCalledWith(quote.cartId, undefined, undefined);
  });

  it('recovers a captured payment from Razorpay when browser verification was interrupted', async () => {
    const order = { ...pendingOrder, razorpayOrderId: 'order_provider_1' };
    prisma.order.findUnique
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: OrderStatus.CONFIRMED });
    razorpay.fetchOrder.mockResolvedValue({ status: 'paid' });
    razorpay.fetchPaymentsForOrder.mockResolvedValue([
      {
        id: 'pay_1',
        entity: 'payment',
        amount: quote.totalPaise,
        currency: 'INR',
        status: 'captured',
        order_id: 'order_provider_1',
      },
    ]);

    await expect(
      service.resolveCheckoutStatus('order_provider_1', undefined, 'guest-token'),
    ).resolves.toMatchObject({ status: OrderStatus.CONFIRMED });
    expect(carts.requireOwnedCart).toHaveBeenCalledWith(quote.cartId, undefined, 'guest-token');
    expect(transaction.payment.upsert).toHaveBeenCalledTimes(1);
  });

  it('stores a trusted captured payment and invokes atomic confirmation', async () => {
    const order = { ...pendingOrder, razorpayOrderId: 'order_provider_1' };
    await service.applyCapturedPayment(order, {
      id: 'pay_1',
      entity: 'payment',
      amount: quote.totalPaise,
      currency: 'INR',
      status: 'captured',
      order_id: 'order_provider_1',
      captured: true,
      method: 'upi',
    });

    expect(transaction.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          orderId: order.id,
          status: 'CAPTURED',
          amountPaise: quote.totalPaise,
        }),
      }),
    );
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('does not relink a provider payment already owned by another order', async () => {
    transaction.payment.findUnique.mockResolvedValue({
      orderId: 'different-order-id',
    });
    const order = { ...pendingOrder, razorpayOrderId: 'order_provider_1' };

    await expect(
      service.applyCapturedPayment(order, {
        id: 'pay_1',
        entity: 'payment',
        amount: quote.totalPaise,
        currency: 'INR',
        status: 'captured',
        order_id: 'order_provider_1',
      }),
    ).rejects.toThrow('already linked to another order');
    expect(transaction.payment.upsert).not.toHaveBeenCalled();
    expect(transaction.$executeRaw).not.toHaveBeenCalled();
  });

  it('reconciles a paid provider order with a captured payment', async () => {
    const order = { ...pendingOrder, razorpayOrderId: 'order_provider_1' };
    prisma.order.findMany.mockResolvedValue([order]);
    razorpay.fetchOrder.mockResolvedValue({ status: 'paid' });
    razorpay.fetchPaymentsForOrder.mockResolvedValue([
      {
        id: 'pay_1',
        entity: 'payment',
        amount: quote.totalPaise,
        currency: 'INR',
        status: 'captured',
        order_id: 'order_provider_1',
      },
    ]);

    await expect(service.reconcilePending()).resolves.toEqual({
      inspected: 1,
      confirmed: 1,
      failed: 0,
      pending: 0,
      errors: 0,
    });
    expect(transaction.payment.upsert).toHaveBeenCalledTimes(1);
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('releases abandoned expired quote reservations during reconciliation', async () => {
    await service.reconcilePending();

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: OrderStatus.PAYMENT_PENDING }),
      }),
    );
  });
});
