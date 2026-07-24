import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('authentication migration', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'prisma/migrations/20260723170000_auth_roles_addresses_audit/migration.sql',
    ),
    'utf8',
  );

  it('links profiles and customer-owned records to Supabase auth users', () => {
    expect(migration).toContain('references auth.users (id) on delete cascade');
    expect(migration).toContain('create trigger on_auth_user_created');
    expect(migration).toContain("values (new.id, 'customer'::public.app_role)");
  });

  it('enables RLS and scopes profile, role, and address policies', () => {
    for (const table of ['profiles', 'roles', 'user_roles', 'addresses', 'audit_logs']) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain('using ((select auth.uid()) = id)');
    expect(migration).toContain('using ((select auth.uid()) = user_id)');
    expect(migration).toContain('with check ((select auth.uid()) = user_id)');
  });

  it('prevents audit log updates and deletes', () => {
    expect(migration).toContain('before update or delete on public.audit_logs');
    expect(migration).toContain("raise exception 'audit logs are immutable'");
  });
});
