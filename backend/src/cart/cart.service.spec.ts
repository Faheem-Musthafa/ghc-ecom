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
        },
      ],
    });
  });
});
