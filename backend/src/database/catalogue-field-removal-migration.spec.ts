import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('catalogue field removal migration', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'prisma/migrations/20260809083000_remove_variant_name_and_product_dimensions/migration.sql',
    ),
    'utf8',
  );

  it('drops the redundant live catalogue columns', () => {
    expect(migration).toContain('alter table public.product_variants');
    expect(migration).toContain('drop column if exists name');
    expect(migration).toContain('alter table public.products');
    expect(migration).toContain('drop column if exists dimensions');
  });
});
