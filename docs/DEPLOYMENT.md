# Deployment

## Reference: Docker Compose on one host

This is suitable for first production release or low/medium traffic. Managed
PostgreSQL/Supabase remains external.

1. Provision Linux host with Docker, DNS, TLS reverse proxy/load balancer, and private
   firewall. Expose only 80/443.
2. Copy `backend/.env.example` to `backend/.env` and inject production values from
   secret manager. Set exact HTTPS `FRONTEND_ORIGIN` and `API_PUBLIC_URL`; use the
   optional comma-separated `FRONTEND_ORIGINS` for additional credentialed CORS origins.
   Generate a unique `CSRF_SECRET` with `openssl rand -base64 48`.

   `localhost` origins are rejected in production unless
   `ALLOW_LOCALHOST_CORS_IN_PRODUCTION=true` is explicitly configured for a local testing
   workflow.
3. Build reviewed commit:

   ```bash
   docker compose -f compose.prod.yml build --pull
   ```

4. Back up database, then run migration as one-off task:

   ```bash
   docker compose -f compose.prod.yml run --rm backend \
     npx prisma migrate deploy
   ```

5. Start:

   ```bash
   docker compose -f compose.prod.yml up -d
   ```

6. Put TLS proxy in front of port 8080. Do not expose backend or Redis directly.
7. Verify `/healthz`, `/api/v1/health`, `/api/v1/ready`, catalogue, auth, cart,
   checkout, webhook delivery, queue processing, invoice, and admin authorization.

For the auth check, confirm login responses contain no access/refresh token, cookies
carry `Secure; HttpOnly; SameSite=Lax`, and a state-changing cookie-authenticated
request without `x-csrf-token` returns 403.

## Managed platform mapping

| Unit | Build/start | Health |
|---|---|---|
| Frontend | `frontend/Dockerfile` | `/healthz` |
| API | `backend/Dockerfile` | `/api/v1/ready` |
| Migration job | backend image, `npx prisma migrate deploy` | one-shot |
| Redis | managed Redis with persistence/noeviction | provider check |
| Database/storage/auth | Supabase production project | provider check |

Deploy immutable image tags from commit SHA. Run migration once before rolling API
replicas. Keep previous application image. Database rollback uses corrective
forward migration, never edited migration history.

## Required production controls

- TLS at edge; automatic certificate renewal.
- Same-origin `/api/v1` routing in production. Auth cookies use `Secure`, `HttpOnly`,
  `SameSite=Lax`, `Path=/`, and the `__Host-` prefix.
- Secret manager and rotation owner.
- `ENABLE_SWAGGER=false`.
- CSP/security headers from `frontend/next.config.mjs` or equivalent CDN config.
- Public source maps disabled; the Next.js production build does not emit browser source maps by default.
- Central JSON logs, request ID, uptime checks, error/latency/queue/payment alerts.
- Daily backups/PITR and tested restore.
- CDN caching for immutable `/_next/static/` assets; catalogue data uses bounded Next.js server-cache revalidation.
- Never cache `/api/v1/auth/*`; the API emits `Cache-Control: private, no-store`.
- Preserve `Set-Cookie`, `Cookie`, `x-csrf-token`, and credentialed CORS behavior
  through every proxy/CDN layer.
- Minimum two API replicas for availability once traffic justifies it.

## Rollback

1. Stop traffic increase and pause checkout if financial state can diverge.
2. Route application traffic to previous image.
3. Keep signed webhooks accepted/durable when safe.
4. Add forward corrective migration if schema caused fault.
5. Reconcile payment, refund, inventory, and order records before reopening checkout.

Detailed operational procedures remain in
`backend/docs/production-readiness.md`.
