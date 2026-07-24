import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('orders, invoices, and outbox migration', () => {
  const migration = readFileSync(
    join(process.cwd(), 'prisma/migrations/20260723220000_orders_invoices_outbox/migration.sql'),
    'utf8',
  );

  it('creates private invoice, outbox, and notification records', () => {
    expect(migration).toContain('create table public.invoices');
    expect(migration).toContain('order_id uuid not null unique');
    expect(migration).toContain('create table public.outbox_events');
    expect(migration).toContain('dedupe_key text not null unique');
    expect(migration).toContain('create table public.notifications');
    expect(migration).toContain('unique (outbox_event_id, channel, recipient)');
  });

  it('enqueues order confirmation exactly once and guards state transitions', () => {
    expect(migration).toContain('create or replace function public.enqueue_order_lifecycle_event');
    expect(migration).toContain('on conflict (dedupe_key) do nothing');
    expect(migration).toContain('create or replace function public.transition_order_status');
    expect(migration).toContain("(current_status = 'confirmed' and p_target = 'processing')");
    expect(migration).toContain("(current_status = 'processing' and p_target = 'shipped')");
    expect(migration).toContain("(current_status = 'shipped' and p_target = 'delivered')");
  });

  it('restores consumed inventory only for a cancellable paid order', () => {
    expect(migration).toContain('create or replace function public.cancel_order');
    expect(migration).toContain("elsif target_order.status = 'confirmed'");
    expect(migration).toContain('set on_hand = on_hand + reservation.quantity');
    expect(migration).toContain("'order_cancellation'");
    expect(migration).toContain("raise exception 'order cannot be cancelled from status %'");
  });

  it('limits invoice and notification reads to the owning customer', () => {
    expect(migration).toContain('create policy invoices_select_own');
    expect(migration).toContain('create policy notifications_select_own');
    expect(migration).toContain('orders.user_id = (select auth.uid())');
  });
});
