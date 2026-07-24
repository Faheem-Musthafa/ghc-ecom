# Production gate evidence

## Ownership

- Environment:
- Commit SHA:
- Release owner:
- Product approver:
- Security approver:
- Date:

## Razorpay test mode

- Checkout success evidence:
- Payment failure evidence:
- Checkout cancellation/abandonment evidence:
- Duplicate webhook event ID and response:
- Full or partial refund ID and final `refund.processed` evidence:
- Reconciliation output:

## Supabase restore

- Source recovery point:
- Isolated restore project:
- Restore start/end:
- RTO / RPO:
- `npm run test:restore` output:
- Approver:

## Performance

- Staging topology and dataset:
- k6 command/environment (secrets redacted):
- `artifacts/k6-summary.json`:
- Error rate:
- Catalogue p95:
- Checkout p95:
- Webhook p95:
- Admin search p95:
- Approved targets and traffic model:

## Security

- Dependency audit:
- Secret scan / gitleaks:
- ZAP report:
- Authenticated penetration-test report:
- Remediation and retest links:

## Production approval

- Carrier and notification providers:
- Backup/PITR owner:
- Rollback owner:
- Go/no-go decision:
- Approvers:
