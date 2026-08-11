import { OrderStatus } from '@prisma/client';
import { renderOrderEmail } from './order-email-template';

describe('renderOrderEmail', () => {
  const order = {
    orderNumber: 'GHC-EMAIL-42',
    status: OrderStatus.CONFIRMED,
    createdAt: new Date('2026-08-06T12:00:00.000Z'),
    totalPaise: 11_198,
    itemsSnapshot: [
      {
        productName: 'Noir Gold Tea Set',
        color: 'Gold',
        sku: 'GHC-TEA-006',
        quantity: 1,
        lineTotalPaise: 11_198,
      },
    ],
  } as never;

  it('renders a complete branded confirmation with the order line item', () => {
    const email = renderOrderEmail(order, 'order.confirmed', 'Faheem');

    expect(email.subject).toBe('Confirmed — your Glockery order GHC-EMAIL-42');
    expect(email.text).toContain('Noir Gold Tea Set (Gold) × 1 — ₹111.98');
    expect(email.html).toContain('GLOCKERY');
    expect(email.html).toContain('Noir Gold Tea Set');
    expect(email.html).toContain('Placed 6 Aug 2026');
    expect(email.html).toContain('VIEW ORDER DETAILS');
    expect(email.html).toContain('CHAT ON WHATSAPP');
    expect(email.html).toContain(
      'https://wa.me/916282000289?text=Hi%20Glockery%20Home%20Centre%2C%20I%20need%20help%20with%20order%20GHC-EMAIL-42.',
    );
    expect(email.text).toContain(
      'WhatsApp support: https://wa.me/916282000289?text=Hi%20Glockery%20Home%20Centre%2C%20I%20need%20help%20with%20order%20GHC-EMAIL-42.',
    );
  });

  it('uses cancellation content and escapes unsafe customer input', () => {
    const email = renderOrderEmail(order, 'order.cancelled', '<script>alert(1)</script>');

    expect(email.subject).toBe('Cancelled — your Glockery order GHC-EMAIL-42');
    expect(email.html).toContain('Your order has been cancelled');
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(email.html).not.toContain('<script>alert(1)</script>');
    expect(email.html).toContain('CHAT ON WHATSAPP');
  });
});
