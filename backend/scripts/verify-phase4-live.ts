import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { PrismaClient, ProductStatus, DiscountType } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { normalizeSupabaseUrl } from '../src/config/env.validation';

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const apiUrl = requireEnvironment('API_PUBLIC_URL');
const prisma = new PrismaClient();
const admin = createClient(
  normalizeSupabaseUrl(requireEnvironment('SUPABASE_URL')),
  requireEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

interface CreatedCart {
  cart: { id: string; subtotalPaise: number };
  guestToken?: string;
}

interface Quote {
  id: string;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  itemsSnapshot: Array<Record<string, unknown>>;
}

async function api<T>(path: string, init: RequestInit = {}, expected = 200): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const text = await response.text();
  if (response.status !== expected) {
    throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const address = {
  recipientName: 'Phase Four Guest',
  phone: '9876543210',
  line1: '4 Inventory Lane',
  line2: '',
  city: 'Mumbai',
  state: 'Maharashtra',
  postalCode: '400001',
  country: 'IN',
};

async function createGuestCart(variantId: string, quantity: number): Promise<CreatedCart> {
  const created = await api<CreatedCart>('/api/v1/carts', { method: 'POST' }, 201);
  assert(created.guestToken, 'Guest cart did not return its access token');
  await api(
    `/api/v1/carts/${created.cart.id}/items`,
    {
      method: 'PUT',
      headers: { 'x-cart-token': created.guestToken },
      body: JSON.stringify({ variantId, quantity }),
    },
    200,
  );
  return created;
}

async function quote(
  cart: CreatedCart,
  couponCode?: string,
): Promise<{ status: number; body: Quote | Record<string, unknown> }> {
  const response = await fetch(`${apiUrl}/api/v1/checkout/quote`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cart-token': cart.guestToken as string,
    },
    body: JSON.stringify({
      cartId: cart.cart.id,
      contactEmail: 'phase4.guest@example.com',
      shippingAddress: address,
      couponCode,
    }),
  });
  return {
    status: response.status,
    body: (await response.json()) as Quote | Record<string, unknown>,
  };
}

async function run(): Promise<void> {
  const suffix = `${Date.now()}-${randomBytes(4).toString('hex')}`;
  const createdCartIds: string[] = [];
  let userId: string | undefined;
  let categoryId: string | undefined;
  let productId: string | undefined;
  let warehouseId: string | undefined;
  let couponId: string | undefined;

  try {
    const category = await prisma.category.create({
      data: {
        name: 'Phase 4 Live',
        slug: `phase4-${suffix}`,
        isPublished: true,
      },
    });
    categoryId = category.id;
    const product = await prisma.product.create({
      data: {
        categoryId,
        name: 'Phase 4 Product',
        slug: `phase4-product-${suffix}`,
        status: ProductStatus.PUBLISHED,
        publishedAt: new Date(),
        variants: {
          create: [
            {
              sku: `P4-QUOTE-${suffix}`.toUpperCase(),
              name: 'Quote variant',
              pricePaise: 50_000,
            },
            {
              sku: `P4-RACE-${suffix}`.toUpperCase(),
              name: 'Concurrency variant',
              pricePaise: 60_000,
            },
          ],
        },
      },
      include: { variants: true },
    });
    productId = product.id;
    const quoteVariant = product.variants[0];
    const raceVariant = product.variants[1];
    assert(quoteVariant && raceVariant, 'Test variants were not created');

    const warehouse = await prisma.warehouse.create({
      data: {
        code: `P4-${randomBytes(4).toString('hex').toUpperCase()}`,
        name: 'Phase 4 Warehouse',
      },
    });
    warehouseId = warehouse.id;
    await prisma.inventoryLevel.createMany({
      data: [
        { warehouseId, variantId: quoteVariant.id, onHand: 5, lowStockThreshold: 1 },
        { warehouseId, variantId: raceVariant.id, onHand: 2, lowStockThreshold: 1 },
      ],
    });

    const coupon = await prisma.coupon.create({
      data: {
        code: `P4TEN${randomBytes(3).toString('hex').toUpperCase()}`,
        type: DiscountType.PERCENT,
        value: 1000,
        maximumDiscountPaise: 20_000,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    couponId = coupon.id;

    const cart = await createGuestCart(quoteVariant.id, 2);
    createdCartIds.push(cart.cart.id);
    const cartView = await api<{ subtotalPaise: number }>(`/api/v1/carts/${cart.cart.id}`, {
      headers: { 'x-cart-token': cart.guestToken as string },
    });
    assert(cartView.subtotalPaise === 100_000, 'Cart total did not use stored variant price');
    console.log('✓ Guest cart totals use server-side variant prices');

    const quoted = await quote(cart, coupon.code);
    assert(quoted.status === 201, `Coupon quote failed with ${quoted.status}`);
    const quoteBody = quoted.body as Quote;
    assert(
      quoteBody.subtotalPaise === 100_000 &&
        quoteBody.discountPaise === 10_000 &&
        quoteBody.shippingPaise === 0 &&
        quoteBody.taxPaise === 0 &&
        quoteBody.totalPaise === 90_000,
      'Server-side pricing totals are incorrect',
    );
    console.log('✓ Coupon, shipping, GST, and final paise totals are correct');

    await prisma.productVariant.update({
      where: { id: quoteVariant.id },
      data: { pricePaise: 99_999 },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { name: 'Phase 4 Product Renamed' },
    });
    const storedQuote = await prisma.checkoutQuote.findUniqueOrThrow({
      where: { id: quoteBody.id },
    });
    const snapshot = storedQuote.itemsSnapshot as Array<Record<string, unknown>>;
    assert(
      snapshot[0]?.unitPricePaise === 50_000 && snapshot[0]?.productName === 'Phase 4 Product',
      'Quote snapshot changed after catalogue edits',
    );
    console.log('✓ Checkout snapshot remains immutable after catalogue edits');

    await prisma.inventoryReservation.updateMany({
      where: { cartId: cart.cart.id, status: 'ACTIVE' },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await prisma.$executeRaw`select public.release_expired_inventory_reservations()`;
    const releasedLevel = await prisma.inventoryLevel.findUniqueOrThrow({
      where: {
        warehouseId_variantId: { warehouseId, variantId: quoteVariant.id },
      },
    });
    assert(releasedLevel.reserved === 0, 'Expired reservation did not restore availability');
    console.log('✓ Expired reservations restore inventory availability');

    const first = await createGuestCart(raceVariant.id, 2);
    const second = await createGuestCart(raceVariant.id, 2);
    createdCartIds.push(first.cart.id, second.cart.id);
    const competing = await Promise.all([quote(first), quote(second)]);
    assert(
      competing.filter(({ status }) => status === 201).length === 1 &&
        competing.filter(({ status }) => status === 409).length === 1,
      `Concurrent reservation results were ${competing.map(({ status }) => status).join(', ')}`,
    );
    const raceLevel = await prisma.inventoryLevel.findUniqueOrThrow({
      where: {
        warehouseId_variantId: { warehouseId, variantId: raceVariant.id },
      },
    });
    assert(raceLevel.reserved === 2 && raceLevel.reserved <= raceLevel.onHand, 'SKU was oversold');
    console.log('✓ Concurrent checkout attempts cannot oversell the SKU');

    const email = `phase4.customer.${suffix}@gmail.com`;
    const password = `T3st!${randomBytes(18).toString('base64url')}`;
    const { data: createdUser, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (userError) throw userError;
    userId = createdUser.user.id;
    const login = await api<{ authenticated: boolean }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    assert(login.authenticated, 'Authenticated customer login failed');
    const customerAuth = createClient(
      normalizeSupabaseUrl(requireEnvironment('SUPABASE_URL')),
      requireEnvironment('SUPABASE_ANON_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: signedIn, error: signInError } = await customerAuth.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !signedIn.session)
      throw signInError || new Error('Customer test token unavailable');
    const customerCart = await api<CreatedCart>(
      '/api/v1/carts',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${signedIn.session.access_token}` },
      },
      201,
    );
    createdCartIds.push(customerCart.cart.id);
    assert(!customerCart.guestToken, 'Authenticated cart exposed a guest token');
    console.log('✓ Authenticated and guest cart ownership modes both work');
  } finally {
    for (const cartId of createdCartIds) {
      await prisma.$executeRaw`select public.release_cart_reservations(${cartId}::uuid)`;
    }
    await prisma.checkoutQuote.deleteMany({ where: { cartId: { in: createdCartIds } } });
    await prisma.inventoryReservation.deleteMany({ where: { cartId: { in: createdCartIds } } });
    await prisma.cartItem.deleteMany({ where: { cartId: { in: createdCartIds } } });
    await prisma.cart.deleteMany({ where: { id: { in: createdCartIds } } });
    if (couponId) await prisma.coupon.delete({ where: { id: couponId } });
    if (warehouseId) {
      await prisma.stockMovement.deleteMany({ where: { warehouseId } });
      await prisma.inventoryLevel.deleteMany({ where: { warehouseId } });
      await prisma.warehouse.delete({ where: { id: warehouseId } });
    }
    if (productId) await prisma.product.delete({ where: { id: productId } });
    if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
    if (userId) await admin.auth.admin.deleteUser(userId);
    await prisma.$disconnect();
  }
}

void run()
  .then(() => console.log('Phase 4 live verification passed; temporary data was removed.'))
  .catch((error: unknown) => {
    console.error(
      `Phase 4 live verification failed: ${error instanceof Error ? error.message : error}`,
    );
    process.exitCode = 1;
  });
