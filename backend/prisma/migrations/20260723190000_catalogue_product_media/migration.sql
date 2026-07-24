create type public.product_status as enum ('draft', 'published', 'archived');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  is_published boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_parent_id_idx on public.categories (parent_id);
create index categories_is_published_sort_order_idx
  on public.categories (is_published, sort_order);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  short_description text check (
    short_description is null or char_length(short_description) <= 300
  ),
  description text,
  status public.product_status not null default 'draft',
  attributes jsonb not null default '{}'::jsonb check (
    jsonb_typeof(attributes) = 'object'
  ),
  seo_title text check (seo_title is null or char_length(seo_title) <= 70),
  seo_description text check (
    seo_description is null or char_length(seo_description) <= 170
  ),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_id_idx on public.products (category_id);
create index products_status_published_at_idx
  on public.products (status, published_at);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique check (
    char_length(sku) between 1 and 80 and sku = upper(sku)
  ),
  name text not null check (char_length(name) between 1 and 120),
  price_paise integer not null check (price_paise >= 0),
  compare_at_price_paise integer check (
    compare_at_price_paise is null
    or compare_at_price_paise >= price_paise
  ),
  attributes jsonb not null default '{}'::jsonb check (
    jsonb_typeof(attributes) = 'object'
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_variants_product_id_is_active_idx
  on public.product_variants (product_id, is_active);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  alt_text text not null check (char_length(alt_text) between 1 and 180),
  sort_order integer not null default 0 check (sort_order >= 0),
  source_filename text not null check (char_length(source_filename) between 1 and 255),
  source_mime_type text not null,
  source_width integer not null check (source_width > 0),
  source_height integer not null check (source_height > 0),
  thumbnail_path text not null unique,
  thumbnail_url text not null,
  thumbnail_width integer not null check (thumbnail_width between 1 and 400),
  thumbnail_height integer not null check (thumbnail_height > 0),
  thumbnail_bytes integer not null check (thumbnail_bytes > 0),
  medium_path text not null unique,
  medium_url text not null,
  medium_width integer not null check (medium_width between 1 and 800),
  medium_height integer not null check (medium_height > 0),
  medium_bytes integer not null check (medium_bytes > 0),
  large_path text not null unique,
  large_url text not null,
  large_width integer not null check (large_width between 1 and 1600),
  large_height integer not null check (large_height > 0),
  large_bytes integer not null check (large_bytes > 0),
  created_at timestamptz not null default now()
);

create index product_images_product_id_sort_order_idx
  on public.product_images (product_id, sort_order);

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger product_variants_set_updated_at
before update on public.product_variants
for each row execute function public.set_updated_at();

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;

revoke all on public.categories from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.product_variants from anon, authenticated;
revoke all on public.product_images from anon, authenticated;

grant select on public.categories to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.product_variants to anon, authenticated;
grant select on public.product_images to anon, authenticated;
grant select, insert, update, delete on public.categories to service_role;
grant select, insert, update, delete on public.products to service_role;
grant select, insert, update, delete on public.product_variants to service_role;
grant select, insert, update, delete on public.product_images to service_role;

create policy categories_public_read
on public.categories
for select
to anon, authenticated
using (is_published);

create policy products_public_read
on public.products
for select
to anon, authenticated
using (
  status = 'published'::public.product_status
  and published_at is not null
  and published_at <= now()
  and exists (
    select 1
    from public.categories
    where categories.id = products.category_id
      and categories.is_published
  )
);

create policy product_variants_public_read
on public.product_variants
for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1
    from public.products
    join public.categories on categories.id = products.category_id
    where products.id = product_variants.product_id
      and products.status = 'published'::public.product_status
      and products.published_at is not null
      and products.published_at <= now()
      and categories.is_published
  )
);

create policy product_images_public_read
on public.product_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products
    join public.categories on categories.id = products.category_id
    where products.id = product_images.product_id
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
values
  (
    'product-images',
    'product-images',
    true,
    5242880,
    array['image/webp']
  ),
  (
    'private-documents',
    'private-documents',
    false,
    10485760,
    array['application/pdf']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
