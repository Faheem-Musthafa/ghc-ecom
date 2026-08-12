create table public.product_image_variants (
  image_id uuid not null,
  variant_id uuid not null,
  constraint product_image_variants_pkey primary key (image_id, variant_id),
  constraint product_image_variants_image_id_fkey
    foreign key (image_id)
    references public.product_images(id)
    on delete cascade,
  constraint product_image_variants_variant_id_fkey
    foreign key (variant_id)
    references public.product_variants(id)
    on delete cascade
);

insert into public.product_image_variants (image_id, variant_id)
select id, variant_id
from public.product_images
where variant_id is not null
on conflict do nothing;

create index product_image_variants_variant_id_image_id_idx
  on public.product_image_variants (variant_id, image_id);

drop index if exists public.product_images_variant_id_sort_order_idx;

alter table public.product_images
  drop constraint if exists product_images_variant_id_fkey,
  drop column variant_id;
