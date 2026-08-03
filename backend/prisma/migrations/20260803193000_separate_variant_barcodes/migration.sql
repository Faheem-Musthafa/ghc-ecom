alter table public.product_variants
  add column barcode text;

alter table public.product_variants
  add constraint product_variants_barcode_format_check
  check (
    barcode is null
    or (
      char_length(barcode) between 1 and 80
      and barcode ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
    )
  );

alter table public.product_variants
  add constraint product_variants_barcode_key unique (barcode);
