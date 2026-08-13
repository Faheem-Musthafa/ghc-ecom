import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('reusable variant images migration', () => {
  const migration = readFileSync(
    join(process.cwd(), 'prisma/migrations/20260812170000_reusable_variant_images/migration.sql'),
    'utf8',
  );

  it('backfills legacy assignments before removing the single-variant column', () => {
    expect(migration).toContain('create table public.product_image_variants');
    expect(migration).toContain('select id, variant_id');
    expect(migration).toContain('where variant_id is not null');
    expect(migration.indexOf('insert into public.product_image_variants')).toBeLessThan(
      migration.indexOf('drop column variant_id'),
    );
  });

  it('uses cascading lightweight associations without changing stored image paths', () => {
    expect(migration).toContain('primary key (image_id, variant_id)');
    expect(migration).toContain('on delete cascade');
    expect(migration).not.toContain('thumbnail_path');
    expect(migration).not.toContain('medium_path');
    expect(migration).not.toContain('large_path');
  });
});
