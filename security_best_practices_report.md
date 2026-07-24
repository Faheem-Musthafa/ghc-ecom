# Security best-practices audit

Audit date: 2026-07-24

Scope: React/Vite frontend, NestJS/Express backend, Prisma, containers, CI, and
browser/server integration.

## Executive summary

No critical vulnerability was confirmed. All application-code findings discovered in
this audit are resolved. Normal browser session credentials are no longer readable by
JavaScript: Supabase access and refresh tokens are stored only in backend-managed
production cookies with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and
`__Host-` controls. Cookie-authenticated mutations require a signed CSRF token.
Supabase password-recovery links necessarily deliver one-time credentials to the
browser; those stay only in component memory and are removed from the URL immediately.

The Razorpay hosted Checkout script remains an inherent, explicitly accepted
third-party supply-chain dependency. It is restricted to the exact provider origin
and backed by server-side signature and payment-state verification. Razorpay's
documented hosted script is not a stable versioned artifact for which this project can
safely invent an SRI hash.

## Findings

### SEC-001 — JavaScript-accessible session tokens

- Severity: Medium
- Original evidence: browser access and refresh tokens were stored in
  `sessionStorage` and copied into `Authorization` headers.
- Impact: successful same-origin XSS could steal active credentials.
- Fix: backend BFF now owns Supabase credentials in hardened cookies. Auth JSON
  contains only public user data and an in-memory CSRF token. Refresh rotation,
  logout, cart identity, and protected routes all support the cookie boundary.
- Verification: E2E test confirms response bodies contain no provider token, all
  three auth cookies are `HttpOnly`/`SameSite=Lax`, missing CSRF is rejected, and a
  valid token permits logout.
- Status: Resolved.

### SEC-002 — Product JSON-LD script injection

- Severity: Medium
- Original evidence: product/API strings entered a JSON-LD script with
  `dangerouslySetInnerHTML`.
- Fix: serializer escapes script-closing and HTML-significant characters plus Unicode
  line separators.
- Verification: frontend test covers a crafted `</script>` payload.
- Status: Resolved.

### SEC-003 — Untrusted invoice URL navigation

- Severity: Medium
- Original evidence: an API-provided invoice URL opened directly.
- Fix: shared navigation helper parses URLs, allows HTTPS or localhost HTTP only,
  applies `noopener,noreferrer`, and clears opener context.
- Status: Resolved.

### SEC-004 — Missing deployable browser security headers

- Severity: Medium
- Fix: production Nginx sets a restrictive CSP, frame denial, `nosniff`, referrer
  policy, and permissions policy. Hashed assets are immutable; the SPA shell is not
  long-term cached.
- Operational requirement: verify headers at the public CDN/edge after every routing
  change.
- Status: Resolved in the reference deployment.

### SEC-005 — API resource and trust-boundary defaults

- Severity: Medium
- Fix: explicit body/parameter limits, request/provider timeouts, request-ID bounds,
  numeric proxy trust, exact credentialed CORS, and an explicit header/method
  allowlist.
- Note: raw-body parsing remains intentional for exact Razorpay webhook signature
  verification.
- Status: Resolved.

### SEC-006 — Authentication endpoint abuse controls

- Severity: Medium
- Fix: dedicated throttles and block windows protect signup, login, refresh, password
  reset email, and password update routes. Provider errors are not exposed.
- Operational requirement: supplement IP throttles with Supabase/edge detection for
  distributed attacks.
- Status: Resolved baseline.

### SEC-007 — Production error detail exposure

- Severity: Low
- Fix: raw frontend exception details render only in development. Backend production
  errors omit stacks and internal provider detail.
- Status: Resolved.

### SEC-008 — Mutable third-party Razorpay Checkout script

- Severity: Low/inherent vendor risk
- Evidence: the official runtime Checkout script is delivered by
  `https://checkout.razorpay.com`.
- Controls: exact CSP script origin, restricted frame/connect origins, strict
  referrer policy, no frontend payment secret, backend-computed amount, HMAC
  verification, webhook verification, and provider-state reconciliation.
- Decision: retain the provider-supported loader. Do not self-host or pin an
  unofficial mutable copy; review provider guidance and CSP quarterly.
- Status: Risk accepted; no unsupported code change made.

### SEC-009 — Password reset falsely reported success

- Severity: High
- Original evidence: the reset page waited one second and displayed success without
  changing any credential.
- Impact: users could believe a compromised password was replaced when it remained
  valid.
- Fix: the one-time recovery access/refresh credentials are consumed from the
  Supabase redirect fragment, removed from browser history immediately, and exchanged
  through an isolated unprivileged Supabase client. The correct user is updated using
  provider controls, then all sessions are revoked. New signup/reset passwords require
  12–128 characters.
- Status: Resolved.

## Verified controls

- Backend DTO validation whitelists fields and rejects unknown input.
- Admin/customer authorization is server-side and covered by E2E tests.
- Upload type, byte content, count, and size checks are tested.
- Price, discount, tax, stock, payment, refund, and order state are server-owned.
- Payment/webhook HMAC checks are timing-safe and use exact raw bytes.
- Auth and recovery responses are `private, no-store`.
- Swagger defaults off; production configuration disables it.
- Runtime dependency audit and repository secret scan are release gates.

## Remaining launch gates

These are operational validation tasks, not known source-code vulnerabilities:

- independent penetration test and authenticated DAST in staging;
- real Razorpay test-mode success/failure/cancel/refund/reconciliation run;
- Supabase redirect allowlist, password policy, and leaked-password protection check;
- restore drill, load test, production header/cookie inspection, secret rotation drill,
  monitoring ownership, and incident-response sign-off.
