# Ecommerce Backend Build Plan

## Status conventions

- `[ ]` Not started
- `[-]` In progress
- `[x]` Built and verified by the listed test cases

Only mark an item `[x]` after its implementation and every associated test case pass. Update this file in the same change that implements a task.

## Progress log

- 2026-07-23: Phase 1 completed. Verified locally and in a clean Docker dependency install with formatting, lint, Prisma validation/seed, 4 unit tests, 5 end-to-end tests, and a production compilation.
- 2026-07-23: Phase 2 implementation started. Auth flows, JWT/role guards, profiles, addresses, audit logging, and the Supabase RLS migration are implemented. Local verification passes with 17 unit tests and 7 end-to-end tests; live Supabase migration/auth/RLS checks remain.
- 2026-07-23: Phase 2 migration deployed to Supabase and recorded as up to date. Verified all five Phase 2 tables have RLS enabled and all five application roles are seeded.
- 2026-07-23: Phase 2 Supabase Auth and RLS live verification passed. Registration, login, refresh, logout, signup profile/role triggers, customer isolation, cross-customer address denial, and admin authorization were verified; all temporary test users were removed. Local verification passes 18 unit tests, 7 end-to-end tests, formatting, linting, and a production build.
- 2026-07-23: Phase 3 completed and deployed to Supabase. Catalogue CRUD, published-only public reads, SKU uniqueness, catalogue-manager authorization, RLS, public/private buckets, guarded uploads, three Sharp WebP derivatives, immutable replacement paths, and Storage cleanup were verified. Local verification passes 28 unit tests, 12 end-to-end tests, formatting, linting, and a production build; live verification removed all temporary data and objects.
- 2026-07-23: Phase 4 completed and deployed to Supabase. Guest/authenticated carts, server-owned paise pricing, coupon limits, GST/shipping totals, warehouse inventory, atomic reservations, expiry release, immutable checkout snapshots, and concurrent no-oversell behavior were verified. Local verification passes 34 unit tests, 13 end-to-end tests, formatting, linting, and a production build; live verification removed all temporary data.
- 2026-07-23: Phase 5 completed and deployed to Supabase. Idempotent Razorpay Orders, Checkout HMAC verification, exact raw-body webhook validation, durable event deduplication, BullMQ retries, atomic paid/failed inventory handling, and scheduled/manual reconciliation are implemented. Local verification passes 48 unit tests and 15 end-to-end tests; live Supabase verification proved confirmation idempotency, failure release, and provider-event uniqueness. A real Razorpay test-mode payment remains part of the Phase 8 staging gate because the local key/webhook secrets are still placeholders.
- 2026-07-23: Phase 6 completed and deployed to Supabase. Customer-owned order history/detail and signed invoice access, audited admin search/transitions, private PDF invoices, pre-fulfilment cancellation/restocking, lifecycle outbox deduplication, BullMQ dispatch, SMTP email, and configurable SMS/WhatsApp delivery are implemented. Local verification passes 60 unit tests and 15 end-to-end tests; live Supabase verification proved order/invoice ownership, valid state transitions, one confirmation event, and exact cancellation restocking.
- 2026-07-23: Phase 7 implementation and Supabase migration completed. Carrier-neutral shipment creation/tracking, customer tracking, 30-day return eligibility/review, idempotent bounded Razorpay refunds, and refund-webhook reconciliation are implemented. Local verification passes 70 unit tests and 15 end-to-end tests; live Supabase verification proved tracking deduplication/state advancement, return eligibility, and refund transaction idempotency. Selecting and credentialing the production courier adapter remains open.
- 2026-07-23: Phase 8 implementation completed for all locally actionable work. Helmet headers, API-error/payment-mismatch/domain Prometheus metrics, one-minute alert checks, configurable alert delivery, dependency auditing, working-tree and Git-history secret scanning, a containerized k6 workload, passive ZAP API scan, restored-database verifier, Razorpay staging verifier, CI hardening, evidence template, and the deployment/rollback/incident/backup/security/Razorpay runbook are built. Checkout now requires a notification contact, abandoned reservations are released by reconciliation, refund idempotency rejects payload drift, lost refund webhooks are reconciled every five minutes, and captured-order cancellation automatically refunds the remaining amount through the durable outbox. The latest regression passes formatting, lint, Prisma validation, 82 unit tests, 15 end-to-end tests, production compilation, zero high-severity npm audit findings, secret scanning, seven applied Supabase migrations, a 29-table read-only integrity self-check, k6 script inspection, and live refund reconciliation. External staging, isolated backup restore, carrier, credential, and penetration-test gates remain open.
- 2026-07-23: Frontend UI foundation completed. Built the initial responsive storefront, catalogue/category/product/cart surfaces, checkout, authentication, customer account, and admin screens. The production build passed with 6 UI route tests and representative shopper/admin surfaces were visually checked at 1440px and 390px.
- 2026-07-23: Frontend redesign and live integration completed. Replaced the editorial theme and legacy CSS/CRA toolchain with a black-and-gold Tailwind CSS v4/Vite system; converted local brand imagery to WebP; bound public catalogue, guest/authenticated cart, auth/session refresh, profile, addresses, orders, invoices, returns, admin catalogue/orders/inventory/operations, server checkout quotes, Razorpay Checkout, and signed payment verification to the backend. The catalogue-empty and API-error states are explicit. TypeScript/Vite production compilation, 6 updated UI/API-bound tests, live backend health/catalogue checks, and 1440×1000/390×844 visual checks pass. A seeded product with inventory, authorized admin accounts, and a real Razorpay test-mode transaction remain staging gates.

## Scope and technical decisions

- [x] Backend: Node.js, TypeScript, NestJS, REST API under `/api/v1`.
- [x] Database and authentication: Supabase Postgres is connected and migrated; live Supabase Auth and RLS behavior are verified.
- [x] Media: Supabase Storage; product images are generated and stored as WebP.
- [-] Payments: Razorpay Orders API, Checkout, signature verification, webhooks, refunds, and reconciliation are built; real Razorpay test-mode staging verification remains.
- [x] Jobs: Redis and BullMQ handle notifications, webhook processing, reconciliation, and retries; bounded product-image derivatives deliberately run inline during authorized admin upload so the request can fail atomically without orphaned source files.
- [x] Monetary values: integer paise only; never floats.
- [-] Frontend: the React/Tailwind storefront, customer account, checkout, and admin UI are bound to the live backend and Razorpay Checkout; a real test-mode payment and role-by-role staging acceptance remain.

## Phase 1 — Foundation `[x]`

### Build checklist

- [x] Create the NestJS TypeScript backend application in `backend/`.
- [x] Add Docker development configuration for API, Redis, and local dependencies.
- [x] Configure environment validation for Supabase, Razorpay, Redis, email, and application URLs.
- [x] Configure structured logs, global error handling, request validation, CORS allowlist, and rate limits.
- [x] Add API health/readiness endpoints and OpenAPI documentation.
- [x] Set up database migrations and a repeatable seed process.
- [x] Configure CI to run formatting, linting, unit tests, integration tests, and migration validation.

### Test cases

- [x] `GET /health` returns `200` when the API is running.
- [x] `GET /ready` fails when Postgres or Redis is unavailable.
- [x] Invalid environment configuration stops startup with a clear error.
- [x] Unknown endpoints return the standard API error format without a stack trace.
- [x] CI passes in a clean dependency-install environment.

## Phase 2 — Authentication, roles, and security `[x]`

### Build checklist

- [x] Configure Supabase Auth for registration, login, logout, password reset, and token refresh.
- [x] Add `profiles`, roles, and user-role mappings linked to `auth.users`.
- [x] Implement backend JWT validation and role guards for customer and admin endpoints.
- [x] Enable RLS on every exposed Supabase table and add least-privilege policies.
- [x] Add address management for authenticated customers.
- [x] Add immutable audit logs for admin, payment, refund, and inventory actions.

### Test cases

- [x] A customer can register, authenticate, refresh a session, and log out.
- [x] An unauthenticated request cannot access customer endpoints.
- [x] A customer cannot read or update another customer's profile, address, cart, or order.
- [x] A non-admin cannot access an admin endpoint.
- [x] Admin mutations write an audit log containing actor, action, target, and timestamp.
- [x] RLS rejects direct database/API access outside the permitted user scope.

## Phase 3 — Catalogue and WebP product media `[x]`

### Build checklist

- [x] Create categories, products, product variants/SKUs, prices, attributes, publish state, and SEO fields.
- [x] Create public read APIs for published categories, products, variants, and search.
- [x] Create protected admin CRUD APIs for catalogue management.
- [x] Create Supabase Storage buckets: public `product-images` and private `private-documents`.
- [x] Validate image content type, file size, dimensions, and decompression limits.
- [x] Convert accepted product images with Sharp to WebP derivatives: thumbnail (400px), medium (800px), and large (1600px).
- [x] Store files under immutable UUID paths and save image metadata in `product_images`.
- [x] Restrict Storage writes/deletes to the backend or authorized administrators; never expose the service-role key to React.

### Test cases

- [x] A published product is returned by the public product API.
- [x] An unpublished product is not returned publicly but is visible to authorized admins.
- [x] A product SKU must be unique.
- [x] An authorized admin upload creates all three WebP derivatives with expected maximum dimensions.
- [x] Non-image, oversized, malformed, or decompression-bomb uploads are rejected.
- [x] A customer/public user cannot upload or delete Storage objects.
- [x] Replacing an image creates a new immutable path and leaves no broken product image reference.

## Phase 4 — Inventory, cart, pricing, and checkout quote `[x]`

### Build checklist

- [x] Add warehouses, inventory levels, stock movements, and low-stock thresholds.
- [x] Add guest and authenticated carts with cart items.
- [x] Create coupon and promotion rules with redemption tracking.
- [x] Implement server-side subtotal, discount, shipping, GST, and final-total calculation.
- [x] Implement short-lived inventory reservations during checkout.
- [x] Add an order draft that snapshots SKU, name, image, price, discount, tax, and delivery address.

### Test cases

- [x] Cart creation, item quantity updates, and item removal produce correct totals.
- [x] A client-supplied price, discount, tax, or user ID is ignored/rejected.
- [x] A coupon cannot exceed its redemption or eligibility rules.
- [x] Checkout cannot reserve more inventory than is available.
- [x] A reservation expires and makes stock available again.
- [x] Concurrent checkout attempts cannot oversell a SKU.
- [x] Order snapshots remain unchanged after a product name or price is edited.

## Phase 5 — Razorpay checkout and payment confirmation `[x]`

### Build checklist

- [x] Add `POST /checkout/intent` to validate cart, reserve stock, create a local pending order, and create a Razorpay Order.
- [x] Return only the Razorpay public key, Razorpay order ID, amount, currency, and approved checkout data to the frontend.
- [x] Add `POST /payments/razorpay/verify` for HMAC signature verification of the Checkout response.
- [x] Add `POST /webhooks/razorpay` using the raw request body and Razorpay webhook signature verification.
- [x] Persist webhook events idempotently and process them through a background job.
- [x] Confirm orders only after trusted payment state is captured/paid; deduct reserved inventory atomically.
- [x] Handle failed payments, abandoned checkout, duplicate delivery, and expired reservations.
- [x] Add scheduled reconciliation for pending/ambiguous local and Razorpay payment states.

### Test cases

- [x] A valid checkout intent creates exactly one local order and Razorpay Order for the server-calculated paise amount.
- [x] An invalid Razorpay Checkout signature is rejected and does not confirm the order.
- [x] A valid `payment.captured` / `order.paid` webhook confirms the order exactly once.
- [x] Duplicate webhook deliveries are accepted safely but do not duplicate stock deductions, emails, or invoices.
- [x] A failed payment transitions the order to failed/cancelled and releases inventory.
- [x] A tampered webhook signature is rejected and logged.
- [x] Reconciliation identifies and resolves an intentionally simulated payment-state mismatch.

## Phase 6 — Orders, notifications, and administration `[x]`

### Build checklist

- [x] Implement the order state machine: `payment_pending → confirmed → processing → shipped → delivered`.
- [x] Implement customer order history and order-detail APIs.
- [x] Add admin order search, filtering, processing, and manual status controls with authorization.
- [x] Generate invoices and store them in private Supabase Storage.
- [x] Add transactional outbox events and retryable email/SMS/WhatsApp notifications.
- [x] Add cancellation rules before fulfilment.

### Test cases

- [x] Invalid order-state transitions are rejected.
- [x] A customer can access only their own orders and invoices.
- [x] Admin filtering returns the expected orders by status, customer, and date.
- [x] A successful order confirmation queues exactly one confirmation notification.
- [x] Failed notification delivery retries and reaches a terminal, observable failure state.
- [x] A cancellation follows policy and restores stock only when appropriate.

## Phase 7 — Shipping, returns, and refunds `[-]`

### Build checklist

- [x] Create shipments, shipment items, tracking events, and delivery-address snapshots.
- [-] Integrate the selected courier/courier aggregator behind a shipping provider interface. The interface and configurable HTTP adapter are built; the production carrier selection and credentials are still required.
- [x] Add customer tracking and delivery-status APIs.
- [x] Add return request, review, received, and approved/rejected states.
- [x] Create Razorpay refunds through an admin-authorized backend workflow.
- [x] Process refund webhooks and reconcile local refund records.

### Test cases

- [x] Shipment tracking events advance order state only through valid transitions.
- [x] A customer cannot request a return outside the configured eligibility window.
- [x] An authorized refund creates exactly one Razorpay refund request per idempotency key.
- [x] Duplicate refund webhooks do not duplicate the local refund.
- [x] A partial refund amount cannot exceed the captured payment/order amount.

## Phase 8 — Production readiness `[-]`

### Build checklist

- [x] Add dashboards and alerts for API errors, job failures, webhook failures, payment mismatches, low stock, and database health.
- [-] Configure automated Supabase backup/point-in-time recovery and test restoration. The drill runbook is complete; dashboard configuration and a non-production restore require project-owner access.
- [-] Add security headers, secret rotation procedure, dependency scanning, and penetration-test remediation. Headers, scanning, and procedures are complete; an external authenticated penetration test and retest evidence remain.
- [-] Add load tests for catalogue, cart, checkout, webhooks, and admin search. The k6 suite and proposed thresholds are complete; staging execution and target approval remain.
- [x] Document production deployment, rollback, incident response, and Razorpay live-mode launch steps.

### Test cases

- [x] An induced webhook processing failure triggers an alert and is safely retried.
- [ ] A backup restore succeeds in a non-production environment.
- [ ] Load tests meet the agreed latency and error-rate targets.
- [x] Secret-scanning confirms no Supabase service key or Razorpay secret is present in frontend code or Git history.
- [ ] Razorpay test-mode success, failure, cancellation, duplicate webhook, and refund scenarios pass before live-mode activation.

## Phase 9 — Black-and-gold Tailwind storefront `[x]`

### Build checklist

- [x] Define a responsive black, gold, and cream Tailwind CSS v4 system with semantic colors, typography, spacing, focus, status, and restrained motion.
- [x] Migrate Create React App to Vite and remove all legacy application CSS, styled-components, and demo catalogue records.
- [x] Build an accessible shared header, product search layer, mobile navigation, cart drawer, and footer.
- [x] Build the image-led home page with collection discovery, backend-powered search/category filters, craft proof, and contact CTA.
- [x] Build category pages with breadcrumb, result count, sorting, empty state, and responsive product grid.
- [x] Build product detail pages with gallery, quantity controls, INR pricing, trust details, specifications, and related products.
- [x] Build the shopping bag with quantity/removal controls, coupon feedback, server-ready summary language, and checkout CTA.
- [x] Add mobile layouts, visible keyboard focus, 44px interaction targets, reduced-motion behavior, lazy product images, and stable media ratios.

### Test cases

- [x] The storefront renders its hero and either the complete live catalogue or an explicit backend-empty state without fallback demo records.
- [x] A mocked live product route renders server paise pricing and adding its variant writes to the backend cart before opening a populated bag.
- [x] Representative storefront views render correctly at 1440×1000 and 390×844 without horizontal overflow.
- [x] The optimized React production build compiles without warnings.

## Phase 10 — Checkout and customer account UI `[-]`

### Build checklist

- [x] Build a labelled delivery/contact form, delivery-method selector, order summary, progress indicator, loading state, and Razorpay handoff screen.
- [x] Build sign-in and registration forms with Supabase-ready API methods, password requirements, loading state, and inline errors.
- [x] Build customer profile and address-management screens.
- [x] Build order history, order detail, delivery timeline, invoice action, and 30-day return-request UI.
- [x] Add a typed frontend API boundary for auth, catalogue, cart, quote, payment intent, payment verification, customer data, orders, returns, invoices, inventory, catalogue administration, and operations.
- [x] Synchronize guest/authenticated cart items with backend cart IDs and server-calculated checkout quotes.
- [x] Launch Razorpay Checkout with the backend-issued intent and send the signed response to backend verification.
- [x] Replace account/order demonstration records with authenticated backend responses and enforce customer route guards.
- [x] Normalize Supabase snake_case sessions, refresh a rejected access token once, and clear invalid sessions safely.

### Test cases

- [x] A populated cart renders all required delivery fields, delivery methods, summary totals, and the Razorpay continuation action.
- [x] Authentication switches between sign-in and registration and exposes the required registration fields.
- [x] Customer order history renders status, expected date, order number, and navigation to detail.
- [ ] A real authenticated customer can complete checkout and see the paid order without a client-trusted amount.
- [ ] Expired sessions refresh safely or return the customer to sign-in without losing their cart in a live staging scenario.

## Phase 11 — Admin commerce UI `[-]`

### Build checklist

- [x] Build the responsive admin navigation and overview with sales, orders, fulfilment, revenue trend, recent orders, and attention states.
- [x] Build order search/filter/table UI.
- [x] Build catalogue list and product editor with publish state, paise price input, and WebP derivative upload guidance.
- [x] Build warehouse inventory, low-stock, reserved/available, and threshold surfaces.
- [x] Build fulfilment queues for shipment creation, tracking, returns, and refunds.
- [x] Build the operational health view for database, Redis/jobs, webhooks, payment mismatches, refunds, and low stock.
- [x] Bind admin catalogue, order, inventory, and operations reads and core product/order mutations to role-authorized backend endpoints.
- [x] Confirm order transitions and saved-address deletion before mutation.
- [ ] Add role-aware navigation visibility and recoverable undo for every supported destructive admin mutation.

### Test cases

- [x] The admin overview renders four primary metrics, attention signals, operational navigation, and recent orders.
- [x] Representative admin views render correctly at 1440×1000 and 390×844.
- [ ] Catalogue manager, warehouse manager, support agent, and administrator see only permitted destinations and actions.
- [x] Mocked admin authorization failures and validation errors are surfaced in the console.
- [ ] Authorized catalogue and order mutations persist in a live staging scenario for every administrative role.

## Phase 12 — Frontend quality and integration `[-]`

### Build checklist

- [x] Add route-level UI regression tests for storefront, product/cart, checkout, auth, account/orders, and admin.
- [x] Use semantic landmarks, labelled form fields, accessible names, focus states, textual statuses, and reduced motion.
- [x] Verify an optimized production build.
- [-] Complete automated browser accessibility, keyboard-only, and cross-browser checks. Manual semantic/focus review and responsive screenshots pass; automated WCAG tooling and Safari/Firefox coverage remain.
- [x] Add API loading, empty, backend-unavailable, validation, cancellation, and authorization states around primary live requests.
- [ ] Add global error-boundary recovery, offline detection, and analytics consent.

### Test cases

- [x] All 6 updated black-and-gold frontend/API-bound regression tests pass.
- [x] The production bundle compiles successfully with no TypeScript or ESLint warnings.
- [ ] Automated accessibility scan reports no critical or serious findings on every primary route.
- [ ] Live API error, empty, slow, timeout, expired-session, and retry states pass in staging.

## Completion gate

- [ ] Every build checklist item and associated test case is marked `[x]`.
- [ ] Staging sign-off is recorded after successful end-to-end Razorpay test-mode payment.
- [ ] Production rollout is approved only after the Phase 8 checks pass.
