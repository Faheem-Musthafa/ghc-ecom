import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('payment and refund lifecycle audit migration', () => {
  const migration = readFileSync(
    join(process.cwd(), 'prisma/migrations/20260724000000_payment_refund_audit/migration.sql'),
    'utf8',
  );

  it('audits trusted payment confirmation and cancellation transitions', () => {
    expect(migration).toContain('create or replace function public.audit_order_lifecycle');
    expect(migration).toContain("'payment.order_confirmed'");
    expect(migration).toContain("'order.cancelled'");
    expect(migration).toContain('create trigger orders_audit_lifecycle');
  });

  it('audits provider-driven refund status changes', () => {
    expect(migration).toContain('create or replace function public.audit_refund_lifecycle');
    expect(migration).toContain("'refund.status_changed'");
    expect(migration).toContain('create trigger refunds_audit_lifecycle');
  });
});
