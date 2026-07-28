import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('rich catalogue migration', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'prisma/migrations/20260728130000_catalogue_rich_media_and_specs/migration.sql',
    ),
    'utf8',
  );

  it('adds storefront specifications and product video storage safely', () => {
    expect(migration).toContain('add column material text');
    expect(migration).toContain('add column dimensions text');
    expect(migration).toContain('create table public.product_videos');
    expect(migration).toContain('create policy product_videos_public_read');
    expect(migration).toContain("'product-videos'");
    expect(migration).toContain("array['video/mp4', 'video/webm', 'video/quicktime']");
  });
});
