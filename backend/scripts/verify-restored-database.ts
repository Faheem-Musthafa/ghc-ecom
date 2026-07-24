import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const expectedTables = [
  'profiles',
  'roles',
  'user_roles',
  'addresses',
  'audit_logs',
  'categories',
  'products',
  'product_variants',
  'product_images',
  'warehouses',
  'inventory_levels',
  'stock_movements',
  'carts',
  'cart_items',
  'coupons',
  'coupon_redemptions',
  'inventory_reservations',
  'checkout_quotes',
  'orders',
  'payments',
  'webhook_events',
  'invoices',
  'outbox_events',
  'notifications',
  'shipments',
  'shipment_items',
  'tracking_events',
  'return_requests',
  'refunds',
] as const;

function supabaseProjectReference(databaseUrl: string): string | undefined {
  const url = new URL(databaseUrl);
  const direct = /^db\.([^.]+)\.supabase\.co$/i.exec(url.hostname)?.[1];
  const pooled = decodeURIComponent(url.username).split('.')[1];
  return direct ?? pooled;
}

const allowCurrentDatabase = process.env.ALLOW_CURRENT_DATABASE_RESTORE_CHECK === 'true';
const restoreUrl =
  process.env.RESTORE_DATABASE_URL ??
  (allowCurrentDatabase ? required('DIRECT_URL') : required('RESTORE_DATABASE_URL'));
if (process.env.DATABASE_URL && !allowCurrentDatabase) {
  const restoreProject = supabaseProjectReference(restoreUrl);
  const configuredProject = supabaseProjectReference(process.env.DATABASE_URL);
  if (
    (restoreProject && restoreProject === configuredProject) ||
    new URL(restoreUrl).host === new URL(process.env.DATABASE_URL).host
  ) {
    throw new Error(
      'RESTORE_DATABASE_URL must not target the configured production Supabase project',
    );
  }
}

const prisma = new PrismaClient({ datasourceUrl: restoreUrl });

async function run(): Promise<void> {
  try {
    const [migrationState, tableState, rlsState, inventoryViolations, orphans] = await Promise.all([
      prisma.$queryRaw<Array<{ total: bigint; failed: bigint }>>`
          select
            count(*)::bigint as total,
            count(*) filter (
              where finished_at is null and rolled_back_at is null
            )::bigint as failed
          from public._prisma_migrations
        `,
      prisma.$queryRaw<Array<{ table_name: string }>>`
          select table_name
          from information_schema.tables
          where table_schema = 'public' and table_type = 'BASE TABLE'
        `,
      prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`
          select c.relname, c.relrowsecurity
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r'
        `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
          select count(*)::bigint as count
          from public.inventory_levels
          where on_hand < 0 or reserved < 0 or reserved > on_hand
        `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
          select (
            (select count(*) from public.orders o
             left join public.checkout_quotes q on q.id = o.quote_id
             where q.id is null) +
            (select count(*) from public.payments p
             left join public.orders o on o.id = p.order_id
             where o.id is null) +
            (select count(*) from public.invoices i
             left join public.orders o on o.id = i.order_id
             where o.id is null) +
            (select count(*) from public.shipments s
             left join public.orders o on o.id = s.order_id
             where o.id is null) +
            (select count(*) from public.refunds r
             left join public.payments p on p.id = r.payment_id
             where p.id is null)
          )::bigint as count
        `,
    ]);

    assert(Number(migrationState[0]?.total ?? 0) >= 7, 'Restore is missing migrations');
    assert(Number(migrationState[0]?.failed ?? 0) === 0, 'Restore has unfinished migrations');
    const presentTables = new Set(tableState.map(({ table_name }) => table_name));
    const missingTables = expectedTables.filter((table) => !presentTables.has(table));
    assert(missingTables.length === 0, `Restore is missing tables: ${missingTables.join(', ')}`);
    const rlsByTable = new Map(
      rlsState.map(({ relname, relrowsecurity }) => [relname, relrowsecurity]),
    );
    const withoutRls = expectedTables.filter((table) => rlsByTable.get(table) !== true);
    assert(withoutRls.length === 0, `RLS is disabled on: ${withoutRls.join(', ')}`);
    assert(
      Number(inventoryViolations[0]?.count ?? 0) === 0,
      'Restored inventory invariants are violated',
    );
    assert(Number(orphans[0]?.count ?? 0) === 0, 'Restored relational data has orphans');

    console.log(
      JSON.stringify(
        {
          status: 'passed',
          migrations: Number(migrationState[0]?.total ?? 0),
          tables: expectedTables.length,
          rlsTables: expectedTables.length,
          inventoryViolations: 0,
          relationshipOrphans: 0,
          verifiedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void run().catch((error: unknown) => {
  console.error(`Restore verification failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
