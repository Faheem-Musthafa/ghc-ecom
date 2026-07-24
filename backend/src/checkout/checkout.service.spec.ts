import { BadRequestException } from '@nestjs/common';
import { CartStatus, DiscountType } from '@prisma/client';
import { CheckoutService } from './checkout.service';

describe('CheckoutService', () => {
  it('calculates subtotal, shipping, GST, and total from server-side snapshots', async () => {
    const cart = {
      id: 'cart-id',
      userId: null,
      guestTokenHash: 'hash',
      status: CartStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: 'item-id',
          cartId: 'cart-id',
          variantId: 'variant-id',
          quantity: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
          variant: {
            id: 'variant-id',
            sku: 'SKU-1',
            name: 'Default',
            pricePaise: 100_000,
            attributes: {},
            product: {
              name: 'Stored Product',
              images: [],
            },
          },
        },
      ],
    };
    let quoteData: Record<string, unknown> | undefined;
    const transaction = {
      checkoutQuote: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn(({ data }) => {
          quoteData = data;
          return Promise.resolve({ id: 'quote-id', ...data });
        }),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(transaction)),
    };
    const carts = {
      requireAccessibleCart: jest.fn().mockResolvedValue(cart),
    };
    const service = new CheckoutService(prisma as never, carts as never);

    await service.createQuote(
      {
        cartId: 'cart-id',
        contactEmail: 'guest@example.com',
        shippingAddress: {
          recipientName: 'Guest',
          phone: '9876543210',
          line1: '1 Test Road',
          line2: '',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400001',
          country: 'IN',
        },
      },
      undefined,
      'guest-token',
    );

    expect(quoteData).toMatchObject({
      subtotalPaise: 200_000,
      discountPaise: 0,
      shippingPaise: 0,
      taxPaise: 36_000,
      totalPaise: 236_000,
    });
    expect(quoteData?.itemsSnapshot).toEqual([
      expect.objectContaining({
        unitPricePaise: 100_000,
        quantity: 2,
        lineTotalPaise: 200_000,
      }),
    ]);
  });

  it('rejects a coupon after its global redemption limit is reached', async () => {
    const coupon = {
      id: 'coupon-id',
      code: 'LIMITED',
      type: DiscountType.FIXED,
      value: 1_000,
      minimumSubtotalPaise: 0,
      maximumDiscountPaise: null,
      usageLimit: 1,
      perUserLimit: null,
      startsAt: new Date(Date.now() - 1_000),
      endsAt: new Date(Date.now() + 60_000),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = {
      coupon: { findFirst: jest.fn().mockResolvedValue(coupon) },
      couponRedemption: { count: jest.fn().mockResolvedValue(1) },
    };
    const service = new CheckoutService(prisma as never, {} as never);
    const validateCoupon = (
      service as unknown as {
        validateCoupon: (
          code: string,
          subtotalPaise: number,
          userId: string | null,
        ) => Promise<unknown>;
      }
    ).validateCoupon.bind(service);

    await expect(validateCoupon('LIMITED', 10_000, null)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
