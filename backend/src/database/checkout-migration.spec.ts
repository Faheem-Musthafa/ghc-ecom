import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('inventory, cart, and checkout migration', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'prisma/migrations/20260723200000_inventory_cart_pricing_quote/migration.sql',
    ),
    'utf8',
  );

  it('creates stock, cart, coupon, reservation, and quote tables', () => {
    for (const table of [
      'warehouses',
      'inventory_levels',
      'stock_movements',
      'carts',
      'cart_items',
      'coupons',
      'coupon_redemptions',
      'inventory_reservations',
      'checkout_quotes',
    ]) {
      expect(migration).toContain(`create table public.${table}`);
    }
    expect(migration).toContain('reserved <= on_hand');
    expect(migration).toContain('quantity between 1 and 99');
  });

  it('uses row and advisory locks for atomic no-oversell reservations', () => {
    expect(migration).toContain('create or replace function public.reserve_cart_inventory');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('for update of levels');
    expect(migration).toContain('levels.on_hand - levels.reserved >= item.quantity');
    expect(migration).toContain("raise exception 'insufficient inventory");
  });

  it('releases expired reservations and enables owner-scoped RLS', () => {
    expect(migration).toContain(
      'create or replace function public.release_expired_inventory_reservations',
    );
    expect(migration).toContain("set status = 'expired'");
    expect(migration).toContain('create policy carts_select_own');
    expect(migration).toContain('create policy checkout_quotes_select_own');
    expect(migration).toContain('revoke all on public.coupons from anon, authenticated');
  });
});
