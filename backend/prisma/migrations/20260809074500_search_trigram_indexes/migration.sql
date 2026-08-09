create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create index products_name_trgm_idx
  on public.products using gin (name extensions.gin_trgm_ops);

create index products_short_description_trgm_idx
  on public.products using gin (short_description extensions.gin_trgm_ops);

create index orders_order_number_trgm_idx
  on public.orders using gin (order_number extensions.gin_trgm_ops);

create index orders_razorpay_order_id_trgm_idx
  on public.orders using gin (razorpay_order_id extensions.gin_trgm_ops);

create index orders_address_email_trgm_idx
  on public.orders using gin ((address_snapshot #>> '{email}') extensions.gin_trgm_ops);

create index orders_address_recipient_name_trgm_idx
  on public.orders using gin ((address_snapshot #>> '{recipientName}') extensions.gin_trgm_ops);
