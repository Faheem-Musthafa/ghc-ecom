import { UnauthorizedException } from '@nestjs/common';
import { CartStatus } from '@prisma/client';
import { CartService } from './cart.service';

describe('CartService', () => {
  it('calculates cart totals only from stored variant prices', () => {
    const service = new CartService({} as never, {} as never);
    const cart = {
      id: 'cart-id',
      userId: null,
      guestTokenHash: 'hash',
      status: CartStatus.ACTIVE,
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: 'item-id',
          cartId: 'cart-id',
          variantId: 'variant-id',
          quantity: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
          variant: {
            id: 'variant-id',
            sku: 'SKU-1',
            name: 'Default',
            pricePaise: 12_500,
            images: [{ thumbnailUrl: 'https://images.test/variant-thumbnail.webp' }],
            product: {
              name: 'Stored Product',
              images: [{ thumbnailUrl: 'https://images.test/thumbnail.webp' }],
            },
          },
        },
      ],
    };

    expect(service.view(cart as never)).toMatchObject({
      subtotalPaise: 37_500,
      items: [
        {
          unitPricePaise: 12_500,
          lineTotalPaise: 37_500,
          imageUrl: 'https://images.test/variant-thumbnail.webp',
        },
      ],
    });
  });

  it('uses a shared product image when the selected variant has no image', () => {
    const service = new CartService({} as never, {} as never);
    const cart = {
      id: 'cart-id',
      status: CartStatus.ACTIVE,
      expiresAt: new Date(),
      items: [
        {
          id: 'item-id',
          variantId: 'variant-id',
          quantity: 1,
          variant: {
            sku: 'SKU-1',
            name: 'Sage Green',
            pricePaise: 12_500,
            images: [],
            product: {
              name: 'Stored Product',
              images: [{ thumbnailUrl: 'https://images.test/shared-thumbnail.webp' }],
            },
          },
        },
      ],
    };

    expect(service.view(cart as never).items[0].imageUrl).toBe(
      'https://images.test/shared-thumbnail.webp',
    );
  });

  it('rejects a cart request without querying an invalid UUID sentinel', async () => {
    const prisma = {
      cart: {
        findFirst: jest.fn(),
      },
    };
    const service = new CartService(prisma as never, {} as never);

    await expect(service.getCart('c3fd0b35-6f59-4d7b-be52-4b278bd0895c')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.cart.findFirst).not.toHaveBeenCalled();
  });
});
