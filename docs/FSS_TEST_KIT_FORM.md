# FSS payment gateway — TEST KIT request form

Details for the bank / FSS onboarding team to release the payment gateway TEST KIT
for the Glockery Home Centre website. Values were taken from the deployed
`www.glockery.com` stack on 2026-09-16 (`frontend/` Next.js on Vercel, `backend/`
NestJS on Railway).

Integration type: **Website only** (no mobile app).

| Field | Value |
| --- | --- |
| LIVE URL | `https://www.glockery.com` |
| TEST URL | `https://www.glockery.com` (see note 1) |
| WEBSITE URL IS PUBLICALLY ACCESSIBLE | Yes |
| RESPONSE URL | `https://www.glockery.com/api/v1/payments/fss/response` |
| ERROR URL (if requested separately) | `https://www.glockery.com/api/v1/payments/fss/error` |
| DEVELOPER CONTACT NO | _______________________ |
| DEVELOPER EMAIL ID | `rafeeh@lincolegroup.com` |
| TYPE | Website (e-commerce storefront) |
| PROGRAMMING LANGUAGE | TypeScript / JavaScript (Node.js 24 LTS) |
| SEAMLESS / NON-SEAMLESS INTEGRATION | Non-seamless (customer is redirected to the bank hosted payment page and returned to the Response URL) |
| SERVER PAGE / FRAMEWORK & VERSION | Storefront: Next.js 16.3 (React 19.2). API: NestJS 11 on Express 5, Node.js 24 |
| APP / WEB SERVER | Node.js 24 (Express via NestJS). Storefront hosted on Vercel, API hosted on Railway behind the platform reverse proxy with TLS termination |
| POST SUPPORTED (IN FSS 80 & 443 ARE MANDATORY) | Yes. HTTPS `POST` on port 443 is supported; port 80 is open and permanently redirects (308) to 443 |
| OPERATING SYSTEM & BIT | Linux 64-bit (Alpine Linux container, `node:24-alpine`, x86_64) |
| SSL (YES / NO) — SERVICE PROVIDER NAME | YES — Let's Encrypt (certificate managed by Vercel for `www.glockery.com`; Railway for the API host). Verified 2026-09-16: issuer `Let's Encrypt`, subject `CN=www.glockery.com` |

## Notes for the bank

1. **Test URL.** There is no separate staging domain yet. The production
   domain will be used for test-kit integration with the bank's **test**
   merchant credentials and **test** gateway URL; the storefront switches
   gateway by server-side configuration only.
2. **Response URL.** The bank should `POST` the transaction response
   (`application/x-www-form-urlencoded`) to the Response URL. The endpoint
   replies with `REDIRECT=<merchant result page>` in the response body as per
   the FSS convention (an HTTP 302 mode is also available if the bank prefers
   browser redirects). The same URL may be registered as the Error URL if the
   bank does not need a distinct one.
3. **Outbound traffic.** The API calls the bank gateway only over HTTPS/443.
   Outbound IPs are dynamic (managed hosting); IP allow-listing of the
   merchant is therefore not possible — please rely on the merchant ID,
   password and resource key.
4. **Inbound traffic.** The Response URL accepts requests from any source IP;
   authenticity is established by decrypting `trandata` with the shared
   resource key. If the bank publishes a webhook / callback IP range we can
   optionally allow-list it.

## Internal notes (not for the bank)

- Implementation lives in `backend/src/payments/fss/`. See
  `docs/INTEGRATIONS.md` → "FSS bank payment gateway" for configuration.
- Response/Error URLs are exempted from CSRF (`backend/src/auth/csrf.service.ts`)
  and rate limited.
- `www.glockery.com/api/*` is proxied to the Railway API by
  `frontend/next.config.mjs`, so the Response URL reaches NestJS directly.
