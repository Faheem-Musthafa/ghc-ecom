# HDFC SmartGateway HyperCheckout — Backend Integration Research

Research date: 2026-08-16. This is an implementation brief based on HDFC
SmartGateway's official HyperCheckout web documentation; it does not add an
integration to this project.

## Recommended flow

1. Generate a merchant 2048-bit RSA key pair on the backend, upload the PEM
   public key during onboarding, and obtain the bank public key and Key UUID.
   Configure `PRIVATE_KEY_PATH`, `PUBLIC_KEY_PATH`, `KEY_UUID`, `MERCHANT_ID`,
   and `PAYMENT_PAGE_CLIENT_ID` in server-only configuration. The private key
   belongs in a server crypto vault and must never reach the browser. In the
   sandbox, the documented payment-page client ID is `hdfcmaster`.
   [Backend setup](https://smartgateway.hdfcbank.com/docs/hypercheckout-mobile-sdk/web/sample-project-setup/backend-setup)

2. Add a merchant backend endpoint (the sample calls it
   `/initiateJuspayPayment`) that invokes the HyperCheckout/Juspay backend SDK
   to create the order session. The frontend calls this endpoint; it must not
   create an order directly with gateway credentials. The SDK response provides
   a hosted browser payment link (`payment_links.web`), which the browser can
   open. [Create an order](https://smartgateway.hdfcbank.com/docs/hypercheckout-mobile-sdk/web/how-to-integrate-sdks/create-an-order-to-open-payment-page)

3. Generate and persist the merchant order before the gateway request. HDFC
   requires `order_id` to be unique, non-sequential, alphanumeric, and under
   21 characters. Send the amount as a string with at most two decimal places.
   `payment_page_client_id` is mandatory; `return_url`, `customer_id`, and
   `merchant_id` are documented as conditional/optional session fields.
   [Create an order](https://smartgateway.hdfcbank.com/docs/hypercheckout-mobile-sdk/web/how-to-integrate-sdks/create-an-order-to-open-payment-page)

4. On return from checkout, call the Order Status SDK/API from a second backend
   endpoint (the sample calls it `/handleJuspayResponse`). HDFC makes the
   server-to-server status call mandatory and says to verify both merchant
   order ID and amount. Do not mark an order paid solely from browser redirect
   parameters. [Handle payment responses](https://smartgateway.hdfcbank.com/docs/hypercheckout-mobile-sdk/web/how-to-integrate-sdks/handle-payment-responses)

5. Configure and consume webhooks as the parallel completion signal. Reconcile
   them with Order Status, then update local payment/order state atomically and
   idempotently. HDFC explicitly recommends using both mechanisms because a
   browser redirect may fail. [Webhooks](https://smartgateway.hdfcbank.com/docs/hypercheckout-mobile-sdk/web/resources/webhooks)

## Webhook requirements

- In the SmartGateway dashboard go to **Payments → Settings → Webhook** and
  register one publicly reachable HTTPS endpoint. SmartGateway sends HTTPS
  `POST` requests to it. [Webhooks](https://smartgateway.hdfcbank.com/docs/hypercheckout-mobile-sdk/web/resources/webhooks)
- Configure webhook username/password in the dashboard. Validate the incoming
  Basic `Authorization` header by Base64-decoding it and comparing the
  `username:password` pair with the configured values. Optional custom headers
  are supported, but `Authorization` must not be used as their name.
  [Webhooks](https://smartgateway.hdfcbank.com/docs/hypercheckout-mobile-sdk/web/resources/webhooks)
- Return HTTP 200 only after durable processing. A non-200 response is retried,
  and the same event can be delivered more than once, so deduplicate by a
  stable gateway event/order/transaction identifier and make payment state
  transitions idempotent. [Webhooks](https://smartgateway.hdfcbank.com/docs/hypercheckout-mobile-sdk/web/resources/webhooks)
- If inbound access is restricted, use HDFC's published environment-specific
  webhook IP allowlist, but retain HTTPS authentication as the primary
  request-validation control. [Webhooks](https://smartgateway.hdfcbank.com/docs/hypercheckout-mobile-sdk/web/resources/webhooks)

## Return URL signature

HDFC offers an optional signed-return flow: after creating a dashboard Response
Key and enabling **Use signed response**, redirect parameters include
`signature` and `signature_algorithm` (`HMAC-SHA256`). The documented verifier
canonicalizes all other parameters, computes an HMAC-SHA256 using the Response
Key, Base64/percent-encodes the result, and compares it with the received
signature. However, HDFC says the signature is not required when the backend
performs authenticated server-side Order Status verification—which remains
mandatory for the response flow. [Return URL HMAC verification](https://smartgateway.hdfcbank.com/docs/hypercheckout-mobile-sdk/web/resources/hmac-signature-verification-for-return-url)

## Project implementation checklist

- Store all key material, Key UUID, merchant/client IDs, and webhook credentials
  in the backend secret manager; never expose them through frontend variables.
- Create a local pending payment record before session creation; persist gateway
  order/session identifiers from the response.
- Add authenticated HTTPS webhook handling with replay/duplicate protection;
  acknowledge only after the transaction commits.
- Build a reconciliation job for pending payments that calls Order Status and
  verifies the local order ID and exact amount before confirmation.
- Keep sandbox and production credentials, keys, webhook credentials, endpoints,
  and test data separate.

## Official sources

- [Backend setup](https://smartgateway.hdfcbank.com/docs/hypercheckout-mobile-sdk/web/sample-project-setup/backend-setup)
- [Backend SDK](https://smartgateway.hdfcbank.com/docs/hypercheckout-mobile-sdk/web/how-to-integrate-sdks/getting-the-backend-sdk)
- [Create an order to open the payment page](https://smartgateway.hdfcbank.com/docs/hypercheckout-mobile-sdk/web/how-to-integrate-sdks/create-an-order-to-open-payment-page)
- [Handle payment responses](https://smartgateway.hdfcbank.com/docs/hypercheckout-mobile-sdk/web/how-to-integrate-sdks/handle-payment-responses)
- [Webhooks](https://smartgateway.hdfcbank.com/docs/hypercheckout-mobile-sdk/web/resources/webhooks)
- [HMAC signature verification for return URL](https://smartgateway.hdfcbank.com/docs/hypercheckout-mobile-sdk/web/resources/hmac-signature-verification-for-return-url)
