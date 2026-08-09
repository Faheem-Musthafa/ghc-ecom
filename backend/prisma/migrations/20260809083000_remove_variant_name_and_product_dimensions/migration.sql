alter table public.product_variants
  drop column if exists name;

alter table public.products
  drop column if exists dimensions;
