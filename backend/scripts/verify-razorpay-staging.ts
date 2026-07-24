import 'dotenv/config';
import { createHmac, randomBytes } from 'node:crypto';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const baseUrl = required('STAGING_API_URL').replace(/\/$/, '');
const variantId = required('STAGING_VARIANT_ID');
const webhookSecret = required('RAZORPAY_WEBHOOK_SECRET');

async function api<T>(
  path: string,
  init: RequestInit = {},
  expected: number | number[] = 200,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  const expectedStatuses = Array.isArray(expected) ? expected : [expected];
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

interface CreatedCart {
  cart: { id: string };
  guestToken: string;
}

interface Quote {
  id: string;
  totalPaise: number;
}

interface Intent {
  keyId: string;
  razorpayOrderId: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
}

interface AdminOrder {
  id: string;
  orderNumber: string;
  status: string;
  payments: Array<{ id: string; status: string; amountPaise: number }>;
}

async function run(): Promise<void> {
  await api('/api/v1/health');
  const cart = await api<CreatedCart>('/api/v1/carts', { method: 'POST' }, 201);
  const headers = {
    'content-type': 'application/json',
    'x-cart-token': cart.guestToken,
  };
  await api(
    `/api/v1/carts/${cart.cart.id}/items`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ variantId, quantity: 1 }),
    },
    200,
  );
  const quote = await api<Quote>(
    '/api/v1/checkout/quote',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cartId: cart.cart.id,
        contactEmail: 'razorpay-staging@example.com',
        shippingAddress: {
          recipientName: 'Razorpay Staging',
          phone: '9876543210',
          line1: 'Staging Test Street',
          line2: '',
          city: 'Pune',
          state: 'Maharashtra',
          postalCode: '411001',
          country: 'IN',
        },
      }),
    },
    201,
  );
  const intent = await api<Intent>(
    '/api/v1/checkout/intent',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ quoteId: quote.id }),
    },
    201,
  );
  assert(intent.amount === quote.totalPaise, 'Intent amount differs from server quote');
  assert(intent.keyId.startsWith('rzp_test_'), 'Staging is not using a Razorpay test key');

  const diagnosticBody = JSON.stringify({
    event: 'diagnostic.staging_gate',
    payload: {},
  });
  const signature = createHmac('sha256', webhookSecret).update(diagnosticBody).digest('hex');
  const eventId = `staging-${Date.now()}-${randomBytes(4).toString('hex')}`;
  for (let delivery = 0; delivery < 2; delivery += 1) {
    await api(
      '/api/v1/webhooks/razorpay',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-razorpay-signature': signature,
          'x-razorpay-event-id': eventId,
        },
        body: diagnosticBody,
      },
      202,
    );
  }

  const paymentId = process.env.RAZORPAY_PAYMENT_ID;
  const checkoutSignature = process.env.RAZORPAY_CHECKOUT_SIGNATURE;
  let verifiedStatus: string | undefined;
  if (paymentId && checkoutSignature) {
    const verified = await api<{ status: string }>(
      '/api/v1/payments/razorpay/verify',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          razorpayOrderId: intent.razorpayOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: checkoutSignature,
        }),
      },
      201,
    );
    verifiedStatus = verified.status;
    assert(verifiedStatus === 'CONFIRMED', 'Captured test payment was not confirmed');
  }

  let refundId: string | undefined;
  const adminToken = process.env.STAGING_ADMIN_TOKEN;
  if (verifiedStatus === 'CONFIRMED' && adminToken) {
    const orders = await api<AdminOrder[]>(
      `/api/v1/admin/orders?search=${encodeURIComponent(intent.orderNumber)}&limit=1`,
      { headers: { authorization: `Bearer ${adminToken}` } },
    );
    const payment = orders[0]?.payments.find(({ status }) => status === 'CAPTURED');
    assert(payment, 'Captured local payment was not visible to staging admin');
    const refund = await api<{ id: string }>(
      '/api/v1/admin/refunds',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          paymentId: payment.id,
          amountPaise: payment.amountPaise,
          idempotencyKey: `staging_${intent.orderId.replaceAll('-', '_')}`,
          reason: 'Automated Razorpay staging gate',
        }),
      },
      201,
    );
    refundId = refund.id;
  }

  console.log(
    JSON.stringify(
      {
        status: paymentId ? 'payment_verified' : 'checkout_action_required',
        checkout: {
          keyId: intent.keyId,
          razorpayOrderId: intent.razorpayOrderId,
          amount: intent.amount,
          currency: intent.currency,
          localOrderId: intent.orderId,
        },
        duplicateWebhookAccepted: true,
        paymentStatus: verifiedStatus,
        localRefundId: refundId,
        next:
          paymentId && checkoutSignature
            ? 'Wait for refund.processed webhook and record the operations dashboard.'
            : 'Open Razorpay Checkout with the returned public fields, then rerun with RAZORPAY_PAYMENT_ID and RAZORPAY_CHECKOUT_SIGNATURE.',
        verifiedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

void run().catch((error: unknown) => {
  console.error(
    `Razorpay staging verification failed: ${error instanceof Error ? error.message : error}`,
  );
  process.exitCode = 1;
});
