create extension if not exists pgcrypto;

create type public.app_role as enum (
  'customer',
  'admin',
  'catalogue_manager',
  'warehouse_manager',
  'support_agent'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  name public.app_role primary key,
  description text
);

insert into public.roles (name, description)
values
  ('customer', 'Store customer'),
  ('admin', 'Full administrative access'),
  ('catalogue_manager', 'Catalogue and product management'),
  ('warehouse_manager', 'Inventory and fulfilment management'),
  ('support_agent', 'Customer and order support');

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null references public.roles (name),
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index user_roles_user_id_idx on public.user_roles (user_id);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  recipient_name text not null check (char_length(recipient_name) between 1 and 120),
  phone text not null check (char_length(phone) between 7 and 20),
  line1 text not null check (char_length(line1) between 1 and 200),
  line2 text,
  city text not null check (char_length(city) between 1 and 100),
  state text not null check (char_length(state) between 1 and 100),
  postal_code text not null check (char_length(postal_code) between 3 and 12),
  country text not null default 'IN' check (char_length(country) = 2),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index addresses_user_id_idx on public.addresses (user_id);
create unique index addresses_one_default_per_user_idx
  on public.addresses (user_id)
  where is_default;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger addresses_set_updated_at
before update on public.addresses
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.phone, '')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer'::public.app_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, full_name, phone)
select
  id,
  nullif(raw_user_meta_data ->> 'full_name', ''),
  nullif(phone, '')
from auth.users
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select id, 'customer'::public.app_role
from auth.users
on conflict (user_id, role) do nothing;

create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit logs are immutable';
end;
$$;

create trigger audit_logs_are_immutable
before update or delete on public.audit_logs
for each row execute function public.prevent_audit_log_mutation();

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.addresses enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.roles from anon, authenticated;
revoke all on public.user_roles from anon, authenticated;
revoke all on public.addresses from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.roles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update, delete on public.addresses to authenticated;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.roles to service_role;
grant select, insert, update, delete on public.user_roles to service_role;
grant select, insert, update, delete on public.addresses to service_role;
grant select, insert on public.audit_logs to service_role;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy roles_read_authenticated
on public.roles
for select
to authenticated
using (true);

create policy user_roles_select_own
on public.user_roles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy addresses_select_own
on public.addresses
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy addresses_insert_own
on public.addresses
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy addresses_update_own
on public.addresses
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy addresses_delete_own
on public.addresses
for delete
to authenticated
using ((select auth.uid()) = user_id);
