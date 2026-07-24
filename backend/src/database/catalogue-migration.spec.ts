import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('catalogue migration', () => {
  const migration = readFileSync(
    join(process.cwd(), 'prisma/migrations/20260723190000_catalogue_product_media/migration.sql'),
    'utf8',
  );

  it('creates catalogue tables with unique SKUs and integer-paise constraints', () => {
    for (const table of ['categories', 'products', 'product_variants', 'product_images']) {
      expect(migration).toContain(`create table public.${table}`);
    }
    expect(migration).toContain('sku text not null unique');
    expect(migration).toContain('price_paise integer not null check (price_paise >= 0)');
    expect(migration).toContain('compare_at_price_paise >= price_paise');
  });

  it('enables RLS and grants public access only to published catalogue data', () => {
    for (const table of ['categories', 'products', 'product_variants', 'product_images']) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain('create policy categories_public_read');
    expect(migration).toContain('create policy products_public_read');
    expect(migration).toContain("status = 'published'::public.product_status");
    expect(migration).toContain('create policy product_variants_public_read');
    expect(migration).toContain('create policy product_images_public_read');
    expect(migration).not.toContain('on storage.objects for insert');
  });

  it('creates a public WebP-only bucket and a private documents bucket', () => {
    expect(migration).toContain("'product-images'");
    expect(migration).toContain("array['image/webp']");
    expect(migration).toContain("'private-documents'");
    expect(migration).toContain("'application/pdf'");
  });
});
