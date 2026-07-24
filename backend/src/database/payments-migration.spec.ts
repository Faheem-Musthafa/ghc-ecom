import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('orders and Razorpay payments migration', () => {
  const migration = readFileSync(
    join(process.cwd(), 'prisma/migrations/20260723210000_razorpay_orders_payments/migration.sql'),
    'utf8',
  );

  it('creates order, payment, and idempotent webhook persistence', () => {
    expect(migration).toContain('create table public.orders');
    expect(migration).toContain('create table public.payments');
    expect(migration).toContain('create table public.webhook_events');
    expect(migration).toContain('provider_event_id text not null unique');
    expect(migration).toContain('razorpay_payment_id text not null unique');
    expect(migration).toContain('quote_id uuid not null unique');
  });

  it('confirms an order and consumes reserved inventory atomically', () => {
    expect(migration).toContain('create or replace function public.confirm_paid_order');
    expect(migration).toContain('for update');
    expect(migration).toContain('on_hand = on_hand - reservation.quantity');
    expect(migration).toContain('reserved = reserved - reservation.quantity');
    expect(migration).toContain("set status = 'consumed'");
    expect(migration).toContain("'sale'");
    expect(migration).toContain("set status = 'confirmed'");
  });

  it('releases inventory for failed orders and protects payment data with RLS', () => {
    expect(migration).toContain('create or replace function public.fail_pending_order');
    expect(migration).toContain('perform public.release_cart_reservations');
    expect(migration).toContain("set status = 'payment_failed'");
    expect(migration).toContain('create policy orders_select_own');
    expect(migration).toContain('create policy payments_select_own');
    expect(migration).toContain(
      'revoke all on public.orders, public.payments, public.webhook_events from anon, authenticated',
    );
  });
});
