alter table public.product_variants
  rename column barcode to alias;

alter table public.product_variants
  rename constraint product_variants_barcode_key to product_variants_alias_key;

alter table public.product_variants
  drop constraint product_variants_barcode_format_check;

alter table public.product_variants
  add constraint product_variants_alias_format_check
  check (
    alias is null
    or (
      char_length(alias) between 1 and 80
      and alias ~ '^[A-Za-z0-9][A-Za-z0-9 ._-]*$'
    )
  );

update public.checkout_quotes
set items_snapshot = (
  select jsonb_agg(
    case
      when entry.item ? 'barcode'
        then (entry.item - 'barcode') || jsonb_build_object('alias', entry.item -> 'barcode')
      else entry.item
    end
    order by entry.ordinality
  )
  from jsonb_array_elements(items_snapshot) with ordinality as entry(item, ordinality)
)
where jsonb_typeof(items_snapshot) = 'array'
  and exists (
    select 1
    from jsonb_array_elements(items_snapshot) as entry(item)
    where entry.item ? 'barcode'
  );

update public.orders
set items_snapshot = (
  select jsonb_agg(
    case
      when entry.item ? 'barcode'
        then (entry.item - 'barcode') || jsonb_build_object('alias', entry.item -> 'barcode')
      else entry.item
    end
    order by entry.ordinality
  )
  from jsonb_array_elements(items_snapshot) with ordinality as entry(item, ordinality)
)
where jsonb_typeof(items_snapshot) = 'array'
  and exists (
    select 1
    from jsonb_array_elements(items_snapshot) as entry(item)
    where entry.item ? 'barcode'
  );
