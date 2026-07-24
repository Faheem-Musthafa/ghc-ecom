create type public.order_status as enum (
  'payment_pending',
  'confirmed',
  'payment_failed',
  'cancelled',
  'processing',
  'shipped',
  'delivered'
);
create type public.payment_status as enum (
  'created', 'authorized', 'captured', 'failed', 'refunded'
);
create type public.webhook_status as enum (
  'received', 'processing', 'processed', 'failed'
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  quote_id uuid not null unique references public.checkout_quotes (id) on delete restrict,
  cart_id uuid not null references public.carts (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  coupon_id uuid references public.coupons (id) on delete restrict,
  status public.order_status not null default 'payment_pending',
  currency text not null default 'INR' check (currency = 'INR'),
  items_snapshot jsonb not null check (jsonb_typeof(items_snapshot) = 'array'),
  address_snapshot jsonb not null check (jsonb_typeof(address_snapshot) = 'object'),
  subtotal_paise integer not null check (subtotal_paise >= 0),
  discount_paise integer not null check (discount_paise >= 0),
  shipping_paise integer not null check (shipping_paise >= 0),
  tax_paise integer not null check (tax_paise >= 0),
  total_paise integer not null check (total_paise > 0),
  razorpay_order_id text unique,
  payment_expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_created_idx on public.orders (user_id, created_at);
create index orders_status_expiry_idx on public.orders (status, payment_expires_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  razorpay_payment_id text not null unique,
  status public.payment_status not null,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  signature_verified boolean not null default false,
  method text,
  captured_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_status_idx on public.payments (order_id, status);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  event_type text not null,
  status public.webhook_status not null default 'received',
  payload jsonb not null,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  processed_at timestamptz,
  received_at timestamptz not null default now()
);
create index webhook_events_status_received_idx
  on public.webhook_events (status, received_at);

create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
for each row execute function public.set_updated_at();

create or replace function public.confirm_paid_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order public.orders%rowtype;
  reservation record;
begin
  select * into target_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'order not found'; end if;
  if target_order.status = 'confirmed' then return; end if;
  if target_order.status <> 'payment_pending' then
    raise exception 'order cannot be confirmed from status %', target_order.status;
  end if;

  for reservation in
    select *
    from public.inventory_reservations
    where cart_id = target_order.cart_id and status = 'active'
    order by variant_id
    for update
  loop
    update public.inventory_levels
    set
      on_hand = on_hand - reservation.quantity,
      reserved = reserved - reservation.quantity
    where warehouse_id = reservation.warehouse_id
      and variant_id = reservation.variant_id
      and reserved >= reservation.quantity
      and on_hand >= reservation.quantity;
    if not found then raise exception 'reserved inventory invariant violated'; end if;

    update public.inventory_reservations
    set status = 'consumed'
    where id = reservation.id;

    insert into public.stock_movements (
      warehouse_id, variant_id, type, quantity, reference_type, reference_id
    ) values (
      reservation.warehouse_id,
      reservation.variant_id,
      'sale',
      -reservation.quantity,
      'order',
      target_order.id::text
    );
  end loop;

  if not exists (
    select 1 from public.inventory_reservations
    where cart_id = target_order.cart_id and status = 'consumed'
  ) then raise exception 'order has no inventory reservations'; end if;

  update public.orders
  set status = 'confirmed', confirmed_at = now()
  where id = target_order.id;
  update public.checkout_quotes set status = 'converted' where id = target_order.quote_id;
  update public.carts set status = 'converted' where id = target_order.cart_id;

  if target_order.coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, order_id)
    values (target_order.coupon_id, target_order.user_id, target_order.id)
    on conflict (coupon_id, order_id) do nothing;
  end if;
end;
$$;

create or replace function public.fail_pending_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_order public.orders%rowtype;
begin
  select * into target_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if target_order.status <> 'payment_pending' then return; end if;
  perform public.release_cart_reservations(target_order.cart_id);
  update public.orders set status = 'payment_failed' where id = target_order.id;
  update public.checkout_quotes set status = 'expired' where id = target_order.quote_id;
end;
$$;

revoke all on function public.confirm_paid_order(uuid) from public, anon, authenticated;
revoke all on function public.fail_pending_order(uuid) from public, anon, authenticated;
grant execute on function public.confirm_paid_order(uuid) to service_role;
grant execute on function public.fail_pending_order(uuid) to service_role;

alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
revoke all on public.orders, public.payments, public.webhook_events from anon, authenticated;
grant select on public.orders, public.payments to authenticated;
grant select, insert, update, delete on public.orders, public.payments, public.webhook_events
to service_role;

create policy orders_select_own on public.orders
for select to authenticated using ((select auth.uid()) = user_id);
create policy payments_select_own on public.payments
for select to authenticated using (
  exists (
    select 1 from public.orders
    where orders.id = payments.order_id
      and orders.user_id = (select auth.uid())
  )
);
