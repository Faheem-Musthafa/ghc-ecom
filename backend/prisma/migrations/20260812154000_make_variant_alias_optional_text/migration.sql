alter table public.product_variants
  drop constraint if exists product_variants_alias_key;

alter table public.product_variants
  drop constraint if exists product_variants_alias_format_check;

alter table public.product_variants
  add constraint product_variants_alias_text_check
  check (
    alias is null
    or char_length(btrim(alias)) between 1 and 80
  );
