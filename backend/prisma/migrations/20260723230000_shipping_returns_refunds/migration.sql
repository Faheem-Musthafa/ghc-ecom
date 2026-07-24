create type public.shipment_status as enum (
  'created', 'label_created', 'in_transit', 'out_for_delivery',
  'delivered', 'exception', 'cancelled'
);
create type public.return_status as enum (
  'requested', 'approved', 'rejected', 'received', 'refund_pending', 'refunded'
);
create type public.refund_status as enum ('pending', 'processed', 'failed');

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null,
  provider_shipment_id text unique,
  tracking_number text unique,
  carrier text,
  status public.shipment_status not null default 'created',
  address_snapshot jsonb not null check (jsonb_typeof(address_snapshot) = 'object'),
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipments_order_status_idx on public.shipments (order_id, status);

create table public.shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  sku text not null,
  quantity integer not null check (quantity > 0)
);
create index shipment_items_shipment_idx on public.shipment_items (shipment_id);

create table public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  provider_event_id text not null,
  status public.shipment_status not null,
  message text,
  location text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (shipment_id, provider_event_id)
);
create index tracking_events_shipment_time_idx
  on public.tracking_events (shipment_id, occurred_at);

create table public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  status public.return_status not null default 'requested',
  reason text not null,
  review_note text,
  eligible_until timestamptz not null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index return_requests_order_status_idx on public.return_requests (order_id, status);
create index return_requests_user_created_idx on public.return_requests (user_id, created_at);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  return_request_id uuid references public.return_requests (id) on delete restrict,
  idempotency_key text not null unique
    check (idempotency_key ~ '^[A-Za-z0-9_-]{10,100}$'),
  razorpay_refund_id text unique,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status public.refund_status not null default 'pending',
  reason text,
  raw_payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index refunds_payment_status_idx on public.refunds (payment_id, status);

create trigger shipments_set_updated_at before update on public.shipments
for each row execute function public.set_updated_at();
create trigger return_requests_set_updated_at before update on public.return_requests
for each row execute function public.set_updated_at();
create trigger refunds_set_updated_at before update on public.refunds
for each row execute function public.set_updated_at();

create or replace function public.advance_shipment_status(
  p_shipment_id uuid,
  p_event_id text,
  p_target public.shipment_status,
  p_message text,
  p_location text,
  p_occurred_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target public.shipments%rowtype;
begin
  select * into target from public.shipments where id = p_shipment_id for update;
  if not found then raise exception 'shipment not found'; end if;

  insert into public.tracking_events (
    shipment_id, provider_event_id, status, message, location, occurred_at
  ) values (
    target.id, p_event_id, p_target, p_message, p_location, p_occurred_at
  ) on conflict (shipment_id, provider_event_id) do nothing;
  if not found then return; end if;

  if not (
    (target.status = 'created' and p_target in ('label_created', 'in_transit', 'cancelled')) or
    (target.status = 'label_created' and p_target in ('in_transit', 'cancelled')) or
    (target.status = 'in_transit' and p_target in ('out_for_delivery', 'delivered', 'exception')) or
    (target.status = 'out_for_delivery' and p_target in ('delivered', 'exception')) or
    (target.status = 'exception' and p_target in ('in_transit', 'out_for_delivery', 'delivered'))
  ) then
    raise exception 'invalid shipment transition from % to %', target.status, p_target;
  end if;

  update public.shipments set
    status = p_target,
    shipped_at = case
      when p_target = 'in_transit' then coalesce(shipped_at, p_occurred_at)
      else shipped_at
    end,
    delivered_at = case
      when p_target = 'delivered' then p_occurred_at
      else delivered_at
    end
  where id = target.id;

  if p_target = 'in_transit' then
    update public.orders set status = 'shipped'
    where id = target.order_id and status = 'processing';
  elsif p_target = 'delivered' then
    update public.orders set status = 'delivered'
    where id = target.order_id and status = 'shipped';
  end if;
end;
$$;

revoke all on function public.advance_shipment_status(
  uuid, text, public.shipment_status, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.advance_shipment_status(
  uuid, text, public.shipment_status, text, text, timestamptz
) to service_role;

alter table public.shipments enable row level security;
alter table public.shipment_items enable row level security;
alter table public.tracking_events enable row level security;
alter table public.return_requests enable row level security;
alter table public.refunds enable row level security;
revoke all on public.shipments, public.shipment_items, public.tracking_events,
  public.return_requests, public.refunds from anon, authenticated;
grant select on public.shipments, public.shipment_items, public.tracking_events,
  public.return_requests, public.refunds to authenticated;
grant select, insert, update, delete on public.shipments, public.shipment_items,
  public.tracking_events, public.return_requests, public.refunds to service_role;

create policy shipments_select_own on public.shipments
for select to authenticated using (
  exists (
    select 1 from public.orders
    where orders.id = shipments.order_id and orders.user_id = (select auth.uid())
  )
);
create policy shipment_items_select_own on public.shipment_items
for select to authenticated using (
  exists (
    select 1 from public.shipments join public.orders
      on orders.id = shipments.order_id
    where shipments.id = shipment_items.shipment_id
      and orders.user_id = (select auth.uid())
  )
);
create policy tracking_events_select_own on public.tracking_events
for select to authenticated using (
  exists (
    select 1 from public.shipments join public.orders
      on orders.id = shipments.order_id
    where shipments.id = tracking_events.shipment_id
      and orders.user_id = (select auth.uid())
  )
);
create policy return_requests_select_own on public.return_requests
for select to authenticated using ((select auth.uid()) = user_id);
create policy refunds_select_own on public.refunds
for select to authenticated using (
  exists (
    select 1 from public.payments join public.orders
      on orders.id = payments.order_id
    where payments.id = refunds.payment_id
      and orders.user_id = (select auth.uid())
  )
);
