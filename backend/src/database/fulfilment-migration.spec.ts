import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('shipping, returns, and refunds migration', () => {
  const migration = readFileSync(
    join(process.cwd(), 'prisma/migrations/20260723230000_shipping_returns_refunds/migration.sql'),
    'utf8',
  );

  it('creates shipment, tracking, return, and refund records', () => {
    for (const table of [
      'shipments',
      'shipment_items',
      'tracking_events',
      'return_requests',
      'refunds',
    ]) {
      expect(migration).toContain(`create table public.${table}`);
    }
    expect(migration).toContain('unique (shipment_id, provider_event_id)');
    expect(migration).toContain('idempotency_key text not null unique');
  });

  it('advances shipment and order states only through allowed transitions', () => {
    expect(migration).toContain('create or replace function public.advance_shipment_status');
    expect(migration).toContain(
      "(target.status = 'in_transit' and p_target in ('out_for_delivery', 'delivered', 'exception'))",
    );
    expect(migration).toContain("update public.orders set status = 'shipped'");
    expect(migration).toContain("update public.orders set status = 'delivered'");
    expect(migration).toContain('on conflict (shipment_id, provider_event_id) do nothing');
  });

  it('enforces positive bounded refund inputs and owner RLS', () => {
    expect(migration).toContain('amount_paise integer not null check (amount_paise > 0)');
    expect(migration).toContain("idempotency_key ~ '^[A-Za-z0-9_-]{10,100}$'");
    expect(migration).toContain('create policy shipments_select_own');
    expect(migration).toContain('create policy return_requests_select_own');
    expect(migration).toContain('create policy refunds_select_own');
  });
});
