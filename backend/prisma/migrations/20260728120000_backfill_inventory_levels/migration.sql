-- Every warehouse must have an inventory row for every catalogue variant. This
-- backfills existing data; new rows are created transactionally by the services.
insert into public.inventory_levels (warehouse_id, variant_id)
select warehouses.id, variants.id
from public.warehouses as warehouses
cross join public.product_variants as variants
on conflict (warehouse_id, variant_id) do nothing;
