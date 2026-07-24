import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { RazorpayService } from './razorpay.service';

describe('RazorpayService signatures', () => {
  const values: Record<string, string> = {
    RAZORPAY_KEY_ID: 'rzp_test_public',
    RAZORPAY_KEY_SECRET: 'checkout-secret',
    RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
  };
  const config = {
    getOrThrow: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
  const service = new RazorpayService(config);

  it('accepts only the expected checkout HMAC', () => {
    const signature = createHmac('sha256', values.RAZORPAY_KEY_SECRET)
      .update('order_123|pay_123')
      .digest('hex');

    expect(service.verifyCheckoutSignature('order_123', 'pay_123', signature)).toBe(true);
    expect(service.verifyCheckoutSignature('order_123', 'pay_tampered', signature)).toBe(false);
    expect(service.verifyCheckoutSignature('order_123', 'pay_123', 'not-hex')).toBe(false);
  });

  it('validates the HMAC over the exact raw webhook bytes', () => {
    const rawBody = Buffer.from('{"event":"payment.captured","value":"exact bytes"}');
    const signature = createHmac('sha256', values.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    expect(service.verifyWebhookSignature(rawBody, signature)).toBe(true);
    expect(
      service.verifyWebhookSignature(
        Buffer.from('{"event":"payment.captured", "value":"exact bytes"}'),
        signature,
      ),
    ).toBe(false);
  });
});
