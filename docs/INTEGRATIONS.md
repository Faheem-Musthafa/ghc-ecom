# Integration setup

## Supabase

1. Create separate development, staging, and production projects.
2. Copy project URL, anon key, and service-role key into backend secret store.
3. Use transaction-pooler URL for `DATABASE_URL`; use direct port 5432 URL for
   `DIRECT_URL`.
4. Run `npx prisma migrate deploy --schema backend/prisma/schema.prisma`.
5. Confirm migrations created `product-images` public bucket and
   `private-documents` private bucket.
6. Create first admin with SQL in `backend/README.md`; use admin API for later role
   changes.
7. In Supabase Auth URL configuration add both:
   `https://YOUR_STORE/auth` and
   `https://YOUR_STORE/auth/reset-password`.
8. Set the production Site URL and allow only explicit development, staging, and
   production redirect URLs; avoid production wildcards.
9. Configure a minimum password length of at least 12 and enable leaked-password
   protection when the Supabase plan supports it.
10. Verify password recovery updates the credential, revokes existing sessions, and
    removes the recovery fragment from the address bar.
11. Verify RLS with anon/customer tokens. Never expose service-role key to frontend.

## Razorpay

1. Start with test-mode key ID, secret, and webhook secret.
2. Set webhook URL:
   `https://YOUR_API/api/v1/webhooks/razorpay`.
3. Subscribe to `payment.captured`, `payment.failed`, `order.paid`,
   `refund.created`, `refund.processed`, and `refund.failed`.
4. Keep provider event ID header enabled; backend uses it for deduplication.
5. Run staging verifier:

   ```bash
   npm run test:staging:razorpay --workspace=backend
   ```

6. Test success, cancel, failure, duplicate webhook, delayed webhook, full/partial
   refund, and reconciliation before live keys.
7. Live and test records/secrets must remain isolated.

Frontend loads Razorpay's official checkout script. Production CSP allowlists only
Razorpay script/frame/connect origins. Re-test checkout whenever provider domains or
CSP change. Razorpay currently documents a mutable hosted Checkout script rather than
a stable versioned SRI artifact; do not self-host or pin an unofficial copy without
written provider support. Treat the exact allowlisted vendor origin as a reviewed
supply-chain dependency.

## FSS bank payment gateway

The FSS (Financial Software & Systems) integration is a non-seamless redirect
flow used by several Indian bank gateways. It runs alongside Razorpay and is
disabled until `FSS_ENABLED=true`.

1. Send the bank the details in `docs/FSS_TEST_KIT_FORM.md` to obtain the TEST
   KIT (tranportal ID, password, terminal resource key, and gateway URL).
2. Configure the backend from the kit:

   ```env
   FSS_ENABLED=true
   FSS_MERCHANT_ID=TRANPORTAL_ID
   FSS_MERCHANT_PASSWORD=TRANPORTAL_PASSWORD
   FSS_RESOURCE_KEY=TERMINAL_RESOURCE_KEY
   FSS_PAYMENT_URL=https://TEST_GATEWAY_HOST/PGServlet
   ```

   `FSS_RESPONSE_URL` / `FSS_ERROR_URL` default to
   `API_PUBLIC_URL + /api/v1/payments/fss/response` and `/error`; register the same
   values with the bank. In production these resolve to
   `https://www.glockery.com/api/v1/payments/fss/...` because the storefront
   proxies `/api/*` to the API.
3. Switch the storefront to the bank page with `NEXT_PUBLIC_PAYMENT_GATEWAY=fss`
   and allow the gateway origin in the CSP form-action list with
   `PAYMENT_FORM_ACTION_ORIGINS=https://TEST_GATEWAY_HOST` (both are build-time
   variables for `frontend/`).
4. Flow: `POST /checkout/fss/intent` creates a pending order with a numeric
   `fssTrackId` and returns the encrypted `trandata` form; the browser posts it to
   the bank; the bank calls the Response URL; the API decrypts, verifies the
   amount, confirms or fails the order idempotently, and answers
   `REDIRECT=<storefront>/checkout/result?order=…&outcome=…`. Plaintext or
   undecryptable callbacks are never trusted — the API runs an inquiry
   (`action=8`) first. Pending FSS orders are reconciled every five minutes via
   the same inquiry (`POST /admin/payments/reconcile/fss` runs it on demand).
5. Refunds for FSS payments are manual (bank merchant portal); the API refuses
   to route them through Razorpay and logs a warning when an FSS-paid order is
   cancelled.
6. Before go-live, verify with the bank kit: field names and result codes in
   `backend/src/payments/fss/fss-gateway.service.ts`, and the AES IV in
   `fss-codec.ts`. Everything else is wire-format independent.

## Redis and BullMQ

- Use TLS/authenticated managed Redis in production.
- Configure `REDIS_URL`; do not expose Redis publicly.
- Use `noeviction` for payment/notification queues.
- Monitor failed jobs, retry count, queue depth, and oldest-job age.
- Scale workers separately from HTTP API when traffic requires it.

## Email and notifications

- Set `EMAIL_FROM` and `RESEND_API_KEY`. Transactional order emails use Resend's HTTPS
  `POST /emails` API, so they work on Railway plans that block outbound SMTP.
- Use a verified Glockery sender such as
  `EMAIL_FROM="Glockery Home Centre <orders@YOUR_VERIFIED_DOMAIN>"`.
- Verify sender domain SPF, DKIM, and DMARC before launch.
- Install the hosted Supabase signup and recovery templates from
  `supabase/templates/README.md`. Supabase Auth owns those two delivery flows; the Nest
  notification worker owns order confirmation and cancellation emails.
- Supabase requires custom SMTP before hosted Auth templates are editable. Configure
  Resend SMTP (`smtp.resend.com`, port `465`, username `resend`, API key as password)
  in Supabase only. Railway never opens that SMTP connection.
- Disable link tracking for Supabase authentication messages so confirmation and recovery
  URLs are not rewritten.
- Optional non-email channel uses `NOTIFICATION_WEBHOOK_URL` and bearer token.
- All provider calls have bounded timeouts; configure retries through durable outbox,
  not an unbounded request loop.

## Shipping provider

- `SHIPPING_PROVIDER_NAME=manual` works without external URL.
- For provider mode set HTTPS `SHIPPING_PROVIDER_URL` and scoped token.
- Provider endpoint must accept `POST /shipments` and return optional `id`,
  `trackingNumber`, and `carrier`.
- Test duplicate fulfilment actions and provider timeout behavior in staging.

## Alerting

Set `ALERT_WEBHOOK_URL` and token for operational alerts. Route alerts to monitored
channel. Alert receiver should return 2xx quickly; backend records provider failures
without blocking API traffic.
