create type public.outbox_status as enum (
  'pending', 'processing', 'processed', 'failed'
);
create type public.notification_channel as enum (
  'email', 'sms', 'whatsapp'
);
create type public.notification_status as enum (
  'pending', 'sent', 'failed'
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict,
  number text not null unique,
  storage_path text not null unique,
  bytes integer not null check (bytes > 0),
  sha256 text not null check (length(sha256) = 64),
  created_at timestamptz not null default now()
);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id text not null,
  event_type text not null,
  dedupe_key text not null unique,
  payload jsonb not null,
  status public.outbox_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index outbox_events_status_available_idx
  on public.outbox_events (status, available_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  outbox_event_id uuid not null references public.outbox_events (id) on delete restrict,
  channel public.notification_channel not null,
  recipient text not null,
  template text not null,
  status public.notification_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  provider_ref text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outbox_event_id, channel, recipient)
);
create index notifications_order_status_idx on public.notifications (order_id, status);
create trigger notifications_set_updated_at before update on public.notifications
for each row execute function public.set_updated_at();

create or replace function public.enqueue_order_lifecycle_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then return new; end if;
  if new.status in ('confirmed', 'cancelled') then
    insert into public.outbox_events (
      aggregate_type, aggregate_id, event_type, dedupe_key, payload
    ) values (
      'order',
      new.id::text,
      'order.' || new.status::text,
      'order-' || new.status::text || ':' || new.id::text,
      jsonb_build_object(
        'orderId', new.id,
        'orderNumber', new.order_number,
        'userId', new.user_id,
        'status', new.status
      )
    ) on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger orders_enqueue_lifecycle_event
after update of status on public.orders
for each row execute function public.enqueue_order_lifecycle_event();

create or replace function public.transition_order_status(
  p_order_id uuid,
  p_target public.order_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare current_status public.order_status;
begin
  select status into current_status
  from public.orders
  where id = p_order_id
  for update;
  if not found then raise exception 'order not found'; end if;

  if not (
    (current_status = 'confirmed' and p_target = 'processing') or
    (current_status = 'processing' and p_target = 'shipped') or
    (current_status = 'shipped' and p_target = 'delivered')
  ) then
    raise exception 'invalid order transition from % to %', current_status, p_target;
  end if;
  update public.orders set status = p_target where id = p_order_id;
end;
$$;

create or replace function public.cancel_order(p_order_id uuid)
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
  if target_order.status = 'cancelled' then return; end if;

  if target_order.status = 'payment_pending' then
    perform public.release_cart_reservations(target_order.cart_id);
    update public.checkout_quotes
    set status = 'expired'
    where id = target_order.quote_id and status = 'active';
  elsif target_order.status = 'confirmed' then
    for reservation in
      select *
      from public.inventory_reservations
      where cart_id = target_order.cart_id and status = 'consumed'
      order by variant_id
      for update
    loop
      update public.inventory_levels
      set on_hand = on_hand + reservation.quantity
      where warehouse_id = reservation.warehouse_id
        and variant_id = reservation.variant_id;
      if not found then raise exception 'inventory level missing for cancellation'; end if;

      update public.inventory_reservations
      set status = 'released'
      where id = reservation.id;
      insert into public.stock_movements (
        warehouse_id, variant_id, type, quantity, reference_type, reference_id, metadata
      ) values (
        reservation.warehouse_id,
        reservation.variant_id,
        'return',
        reservation.quantity,
        'order_cancellation',
        target_order.id::text,
        jsonb_build_object('reason', 'cancelled_before_fulfilment')
      );
    end loop;
  else
    raise exception 'order cannot be cancelled from status %', target_order.status;
  end if;

  update public.orders set status = 'cancelled' where id = target_order.id;
end;
$$;

revoke all on function public.transition_order_status(uuid, public.order_status)
from public, anon, authenticated;
revoke all on function public.cancel_order(uuid) from public, anon, authenticated;
grant execute on function public.transition_order_status(uuid, public.order_status) to service_role;
grant execute on function public.cancel_order(uuid) to service_role;

alter table public.invoices enable row level security;
alter table public.outbox_events enable row level security;
alter table public.notifications enable row level security;
revoke all on public.invoices, public.outbox_events, public.notifications
from anon, authenticated;
grant select on public.invoices, public.notifications to authenticated;
grant select, insert, update, delete
on public.invoices, public.outbox_events, public.notifications to service_role;

create policy invoices_select_own on public.invoices
for select to authenticated using (
  exists (
    select 1 from public.orders
    where orders.id = invoices.order_id
      and orders.user_id = (select auth.uid())
  )
);
create policy notifications_select_own on public.notifications
for select to authenticated using (
  exists (
    select 1 from public.orders
    where orders.id = notifications.order_id
      and orders.user_id = (select auth.uid())
  )
);
