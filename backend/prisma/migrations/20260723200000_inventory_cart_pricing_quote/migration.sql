create type public.cart_status as enum ('active', 'converted', 'abandoned');
create type public.discount_type as enum ('percent', 'fixed');
create type public.reservation_status as enum ('active', 'released', 'consumed', 'expired');
create type public.quote_status as enum ('active', 'converted', 'expired');
create type public.stock_movement_type as enum (
  'receipt',
  'reservation',
  'release',
  'sale',
  'adjustment',
  'return'
);

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  name text not null check (char_length(name) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_levels (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  on_hand integer not null default 0 check (on_hand >= 0),
  reserved integer not null default 0 check (reserved >= 0 and reserved <= on_hand),
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, variant_id)
);

create index inventory_levels_variant_id_idx on public.inventory_levels (variant_id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  type public.stock_movement_type not null,
  quantity integer not null check (quantity <> 0),
  reference_type text,
  reference_id text,
  actor_id uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index stock_movements_variant_id_created_at_idx
  on public.stock_movements (variant_id, created_at);
create index stock_movements_reference_idx
  on public.stock_movements (reference_type, reference_id);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  guest_token_hash text unique,
  status public.cart_status not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (user_id is not null and guest_token_hash is null)
    or (user_id is null and guest_token_hash is not null)
  )
);

create unique index carts_one_active_per_user_idx
  on public.carts (user_id)
  where status = 'active' and user_id is not null;
create index carts_user_id_status_idx on public.carts (user_id, status);
create index carts_expires_at_idx on public.carts (expires_at);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  quantity integer not null check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create index cart_items_variant_id_idx on public.cart_items (variant_id);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  type public.discount_type not null,
  value integer not null check (value > 0),
  minimum_subtotal_paise integer not null default 0 check (minimum_subtotal_paise >= 0),
  maximum_discount_paise integer check (maximum_discount_paise is null or maximum_discount_paise > 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  per_user_limit integer check (per_user_limit is null or per_user_limit > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (type <> 'percent' or value <= 10000)
);

create index coupons_active_window_idx on public.coupons (is_active, starts_at, ends_at);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  order_id uuid not null,
  created_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

create index coupon_redemptions_coupon_user_idx
  on public.coupon_redemptions (coupon_id, user_id);

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status public.reservation_status not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index inventory_reservations_one_active_item_idx
  on public.inventory_reservations (cart_id, variant_id)
  where status = 'active';
create index inventory_reservations_cart_status_idx
  on public.inventory_reservations (cart_id, status);
create index inventory_reservations_expiry_status_idx
  on public.inventory_reservations (expires_at, status);

create table public.checkout_quotes (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete restrict,
  user_id uuid references auth.users (id) on delete cascade,
  coupon_id uuid references public.coupons (id) on delete restrict,
  status public.quote_status not null default 'active',
  currency text not null default 'INR' check (currency = 'INR'),
  items_snapshot jsonb not null check (jsonb_typeof(items_snapshot) = 'array'),
  address_snapshot jsonb not null check (jsonb_typeof(address_snapshot) = 'object'),
  subtotal_paise integer not null check (subtotal_paise >= 0),
  discount_paise integer not null check (discount_paise >= 0),
  shipping_paise integer not null check (shipping_paise >= 0),
  tax_paise integer not null check (tax_paise >= 0),
  total_paise integer not null check (total_paise >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index checkout_quotes_cart_status_idx on public.checkout_quotes (cart_id, status);
create index checkout_quotes_expiry_status_idx on public.checkout_quotes (expires_at, status);

create trigger warehouses_set_updated_at
before update on public.warehouses
for each row execute function public.set_updated_at();
create trigger inventory_levels_set_updated_at
before update on public.inventory_levels
for each row execute function public.set_updated_at();
create trigger carts_set_updated_at
before update on public.carts
for each row execute function public.set_updated_at();
create trigger cart_items_set_updated_at
before update on public.cart_items
for each row execute function public.set_updated_at();
create trigger coupons_set_updated_at
before update on public.coupons
for each row execute function public.set_updated_at();
create trigger inventory_reservations_set_updated_at
before update on public.inventory_reservations
for each row execute function public.set_updated_at();

create or replace function public.release_cart_reservations(p_cart_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation record;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_cart_id::text, 0));
  for reservation in
    select *
    from public.inventory_reservations
    where cart_id = p_cart_id and status = 'active'
    for update
  loop
    update public.inventory_levels
    set reserved = reserved - reservation.quantity
    where warehouse_id = reservation.warehouse_id
      and variant_id = reservation.variant_id;

    insert into public.stock_movements (
      warehouse_id, variant_id, type, quantity, reference_type, reference_id
    )
    values (
      reservation.warehouse_id,
      reservation.variant_id,
      'release',
      reservation.quantity,
      'cart',
      p_cart_id::text
    );
  end loop;

  update public.inventory_reservations
  set status = 'released'
  where cart_id = p_cart_id and status = 'active';
end;
$$;

create or replace function public.release_expired_inventory_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation record;
  released_count integer := 0;
begin
  for reservation in
    select *
    from public.inventory_reservations
    where status = 'active' and expires_at <= now()
    order by expires_at
    for update skip locked
  loop
    update public.inventory_levels
    set reserved = reserved - reservation.quantity
    where warehouse_id = reservation.warehouse_id
      and variant_id = reservation.variant_id;

    update public.inventory_reservations
    set status = 'expired'
    where id = reservation.id;

    insert into public.stock_movements (
      warehouse_id, variant_id, type, quantity, reference_type, reference_id
    )
    values (
      reservation.warehouse_id,
      reservation.variant_id,
      'release',
      reservation.quantity,
      'expired_reservation',
      reservation.id::text
    );
    released_count := released_count + 1;
  end loop;
  return released_count;
end;
$$;

create or replace function public.reserve_cart_inventory(
  p_cart_id uuid,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  selected_level record;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_cart_id::text, 0));
  perform public.release_expired_inventory_reservations();
  perform public.release_cart_reservations(p_cart_id);

  if not exists (select 1 from public.cart_items where cart_id = p_cart_id) then
    raise exception 'cart is empty';
  end if;

  for item in
    select variant_id, quantity
    from public.cart_items
    where cart_id = p_cart_id
    order by variant_id
  loop
    select levels.warehouse_id, levels.variant_id
    into selected_level
    from public.inventory_levels as levels
    join public.warehouses as warehouses on warehouses.id = levels.warehouse_id
    where levels.variant_id = item.variant_id
      and warehouses.is_active
      and levels.on_hand - levels.reserved >= item.quantity
    order by levels.on_hand - levels.reserved desc, levels.warehouse_id
    for update of levels
    limit 1;

    if not found then
      raise exception 'insufficient inventory for variant %', item.variant_id;
    end if;

    update public.inventory_levels
    set reserved = reserved + item.quantity
    where warehouse_id = selected_level.warehouse_id
      and variant_id = selected_level.variant_id;

    insert into public.inventory_reservations (
      cart_id, variant_id, warehouse_id, quantity, status, expires_at
    )
    values (
      p_cart_id,
      item.variant_id,
      selected_level.warehouse_id,
      item.quantity,
      'active',
      p_expires_at
    );

    insert into public.stock_movements (
      warehouse_id, variant_id, type, quantity, reference_type, reference_id
    )
    values (
      selected_level.warehouse_id,
      item.variant_id,
      'reservation',
      -item.quantity,
      'cart',
      p_cart_id::text
    );
  end loop;
end;
$$;

revoke all on function public.release_cart_reservations(uuid) from public, anon, authenticated;
revoke all on function public.release_expired_inventory_reservations() from public, anon, authenticated;
revoke all on function public.reserve_cart_inventory(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.release_cart_reservations(uuid) to service_role;
grant execute on function public.release_expired_inventory_reservations() to service_role;
grant execute on function public.reserve_cart_inventory(uuid, timestamptz) to service_role;

alter table public.warehouses enable row level security;
alter table public.inventory_levels enable row level security;
alter table public.stock_movements enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.checkout_quotes enable row level security;

revoke all on public.warehouses from anon, authenticated;
revoke all on public.inventory_levels from anon, authenticated;
revoke all on public.stock_movements from anon, authenticated;
revoke all on public.carts from anon, authenticated;
revoke all on public.cart_items from anon, authenticated;
revoke all on public.coupons from anon, authenticated;
revoke all on public.coupon_redemptions from anon, authenticated;
revoke all on public.inventory_reservations from anon, authenticated;
revoke all on public.checkout_quotes from anon, authenticated;

grant select on public.carts, public.cart_items, public.inventory_reservations, public.checkout_quotes
to authenticated;
grant select, insert, update, delete on
  public.warehouses,
  public.inventory_levels,
  public.stock_movements,
  public.carts,
  public.cart_items,
  public.coupons,
  public.coupon_redemptions,
  public.inventory_reservations,
  public.checkout_quotes
to service_role;

create policy carts_select_own
on public.carts for select to authenticated
using ((select auth.uid()) = user_id);

create policy cart_items_select_own
on public.cart_items for select to authenticated
using (
  exists (
    select 1 from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = (select auth.uid())
  )
);

create policy reservations_select_own
on public.inventory_reservations for select to authenticated
using (
  exists (
    select 1 from public.carts
    where carts.id = inventory_reservations.cart_id
      and carts.user_id = (select auth.uid())
  )
);

create policy checkout_quotes_select_own
on public.checkout_quotes for select to authenticated
using ((select auth.uid()) = user_id);
