alter table public.products
  add column material text check (material is null or char_length(material) <= 120),
  add column dimensions text check (dimensions is null or char_length(dimensions) <= 100);

create table public.product_videos (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null check (char_length(url) between 1 and 2000),
  storage_path text unique,
  source_filename text check (source_filename is null or char_length(source_filename) <= 255),
  source_mime_type text,
  alt_text text not null check (char_length(alt_text) between 1 and 180),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create index product_videos_product_id_sort_order_idx
  on public.product_videos (product_id, sort_order);

alter table public.product_videos enable row level security;
revoke all on public.product_videos from anon, authenticated;
grant select on public.product_videos to anon, authenticated;
grant select, insert, update, delete on public.product_videos to service_role;

create policy product_videos_public_read
on public.product_videos
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products
    join public.categories on categories.id = products.category_id
    where products.id = product_videos.product_id
      and products.status = 'published'::public.product_status
      and products.published_at is not null
      and products.published_at <= now()
      and categories.is_published
  )
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-videos',
  'product-videos',
  true,
  26214400,
  array['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
