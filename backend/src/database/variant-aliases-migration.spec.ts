import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('variant aliases migration', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'prisma/migrations/20260811090000_rename_variant_barcode_to_alias/migration.sql',
    ),
    'utf8',
  );
  const optionalTextMigration = readFileSync(
    join(
      process.cwd(),
      'prisma/migrations/20260812154000_make_variant_alias_optional_text/migration.sql',
    ),
    'utf8',
  );

  it('renames barcode to alias while preserving variant and order data', () => {
    expect(migration).toContain('rename column barcode to alias');
    expect(migration).toContain('product_variants_alias_format_check');
    expect(migration).toContain(
      'rename constraint product_variants_barcode_key to product_variants_alias_key',
    );
    expect(migration).toContain("entry.item - 'barcode'");
    expect(migration).toContain("jsonb_build_object('alias', entry.item -> 'barcode')");
    expect(migration).toContain('update public.checkout_quotes');
    expect(migration).toContain('update public.orders');
  });

  it('keeps SKU unique while making alias optional non-unique text', () => {
    expect(optionalTextMigration).toContain('drop constraint if exists product_variants_alias_key');
    expect(optionalTextMigration).toContain(
      'drop constraint if exists product_variants_alias_format_check',
    );
    expect(optionalTextMigration).toContain('product_variants_alias_text_check');
    expect(optionalTextMigration).not.toContain('drop constraint product_variants_sku_key');
  });
});
