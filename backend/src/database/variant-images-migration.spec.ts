import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('variant product images migration', () => {
  const migration = readFileSync(
    join(process.cwd(), 'prisma/migrations/20260729124500_variant_product_images/migration.sql'),
    'utf8',
  );

  it('associates images with variants without breaking shared legacy images', () => {
    expect(migration).toContain('add column variant_id uuid');
    expect(migration).toContain('references public.product_variants(id)');
    expect(migration).toContain('on delete set null');
    expect(migration).toContain('product_images_variant_id_sort_order_idx');
  });
});
