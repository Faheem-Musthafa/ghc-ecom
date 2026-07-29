alter table public.product_images
  add column variant_id uuid;

alter table public.product_images
  add constraint product_images_variant_id_fkey
  foreign key (variant_id)
  references public.product_variants(id)
  on delete set null;

create index product_images_variant_id_sort_order_idx
  on public.product_images (variant_id, sort_order);
