# Razorpay Webhook Setup

This project receives Razorpay webhook events at:

```text
https://YOUR-BACKEND-DOMAIN/api/v1/webhooks/razorpay
```

Use the deployed backend domain. Do not use the frontend domain unless it proxies
`/api/v1` requests to the backend.

## 1. Configure the backend

Generate a strong webhook secret:

```bash
openssl rand -hex 32
```

Add the following variables to the backend deployment environment:

```env
RAZORPAY_KEY_ID=rzp_test_your_key
RAZORPAY_KEY_SECRET=your_api_key_secret
RAZORPAY_WEBHOOK_SECRET=the_generated_webhook_secret
```

The webhook secret is separate from `RAZORPAY_KEY_SECRET`. Never expose either
secret through frontend environment variables or commit them to the repository.

For a production-shaped staging environment using test keys:

```env
ALLOW_TEST_PAYMENTS_IN_PRODUCTION=true
```

For the real live environment:

```env
RAZORPAY_KEY_ID=rzp_live_your_key
ALLOW_TEST_PAYMENTS_IN_PRODUCTION=false
```

Deploy the backend and confirm that it is reachable:

```bash
curl https://YOUR-BACKEND-DOMAIN/api/v1/health
```

Apply all database migrations before testing payments:

```bash
npx prisma migrate deploy
```

## 2. Create the Test Mode webhook

1. Open the Razorpay Dashboard in **Test Mode**.
2. Go to **Accounts & Settings**.
3. Select **Webhooks** under Website and app settings.
4. Click **Add New Webhook**.
5. Enter the following URL:

   ```text
   https://YOUR-BACKEND-DOMAIN/api/v1/webhooks/razorpay
   ```

6. Enter exactly the same secret used for `RAZORPAY_WEBHOOK_SECRET`.
7. Add an alert email address.
8. Enable these events:

   ```text
   payment.captured
   payment.failed
   order.paid
   refund.created
   refund.processed
   refund.failed
   ```

9. Create and enable the webhook.

The endpoint must be publicly reachable over HTTPS. Razorpay cannot deliver
webhooks directly to localhost. Webhook deliveries must receive a `2xx` response
within five seconds.

Official documentation:

- [Set up Razorpay webhooks](https://razorpay.com/docs/payments/dashboard/account-settings/webhooks/)
- [Validate and test webhooks](https://razorpay.com/docs/webhooks/validate-test/?preferred-country=IN)
- [Razorpay payment webhook events](https://razorpay.com/docs/webhooks/payments/?preferred-country=IN)
- [Razorpay refund webhook events](https://razorpay.com/docs/payments/refunds/subscribe-to-webhooks/)

## 3. Test the integration

Complete an order through the website while Razorpay and the backend are both
configured for Test Mode.

Verify the following:

- Razorpay's webhook delivery log reports HTTP `202`.
- A captured payment confirms the corresponding local order.
- Failed payments remain unconfirmed.
- Refund events update the matching local refund.
- Repeated delivery of the same event does not process it twice.

Inspect recent webhook records using an administrative database connection or the
Supabase SQL editor:

```sql
select
  event_type,
  status,
  attempts,
  last_error,
  received_at
from webhook_events
order by received_at desc
limit 20;
```

A successfully handled event should have the status `PROCESSED`. Failed events
include a diagnostic message in `last_error`.

## 4. Go live

After Test Mode succeeds:

1. Switch the Razorpay Dashboard to **Live Mode**.
2. Generate and configure the live `rzp_live_*` API credentials.
3. Generate a new webhook secret for the live environment.
4. Update the backend environment variables and redeploy it.
5. Create a separate Live Mode webhook using the production endpoint and live
   webhook secret.
6. Keep `ALLOW_TEST_PAYMENTS_IN_PRODUCTION=false`.
7. Complete one approved low-value live order.
8. Confirm the payment, order, invoice, webhook record, refund flow, and settlement
   before accepting normal traffic.

Keep Test Mode and Live Mode credentials, webhook secrets, data, and webhook
configurations separate.

## Troubleshooting

### HTTP 401: Invalid signature

The secret configured in Razorpay does not match `RAZORPAY_WEBHOOK_SECRET`, or an
intermediary changed the raw request body. Update the secret and redeploy the
backend before retrying.

### HTTP 404: Not found

Confirm that the URL includes the full path:

```text
/api/v1/webhooks/razorpay
```

### Webhook is not delivered

Confirm that the backend is publicly reachable through HTTPS on port 443 and is
not blocked by a firewall, security group, CDN rule, or authentication middleware.
If inbound traffic is restricted, allow Razorpay's documented webhook IP ranges.

### Event has status `FAILED`

Inspect `last_error` in `webhook_events` and the backend logs. Common causes are a
missing local Razorpay order, a mismatched payment amount, or a refund that was not
created through this application.

### Razorpay disables the webhook

Razorpay retries failed webhook deliveries for a limited period and can disable an
endpoint after repeated failures. Fix the endpoint, verify that it returns `202`,
then re-enable it in the Razorpay Dashboard.

## Security behavior implemented by this project

The backend:

- validates `X-Razorpay-Signature` against the exact raw request body;
- requires `X-Razorpay-Event-Id` and uses it for idempotent processing;
- persists events before asynchronous processing;
- accepts webhook requests without customer authentication or CSRF tokens;
- verifies provider order, payment, amount, currency, and refund relationships;
- supports API-based payment-status recovery when browser verification is
  interrupted; and
- returns HTTP `202` after accepting a valid event.
