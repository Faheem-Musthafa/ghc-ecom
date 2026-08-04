import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('variant barcodes migration', () => {
  const migration = readFileSync(
    join(process.cwd(), 'prisma/migrations/20260803193000_separate_variant_barcodes/migration.sql'),
    'utf8',
  );

  it('stores an optional unique barcode separately from the SKU', () => {
    expect(migration).toContain('add column barcode text');
    expect(migration).toContain('product_variants_barcode_format_check');
    expect(migration).toContain('product_variants_barcode_key unique (barcode)');
  });
});
