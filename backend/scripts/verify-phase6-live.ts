import 'dotenv/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  Cart,
  CartStatus,
  CheckoutQuote,
  Order,
  OrderStatus,
  Prisma,
  PrismaClient,
  ProductStatus,
  ReservationStatus,
} from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { normalizeSupabaseUrl } from '../src/config/env.validation';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const prisma = new PrismaClient();
const supabaseUrl = normalizeSupabaseUrl(required('SUPABASE_URL'));
const admin = createClient(supabaseUrl, required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run(): Promise<void> {
  const suffix = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  const userIds: string[] = [];
  const cartIds: string[] = [];
  const quoteIds: string[] = [];
  const orderIds: string[] = [];
  let invoicePath: string | undefined;
  let categoryId: string | undefined;
  let productId: string | undefined;
  let warehouseId: string | undefined;

  try {
    const password = `T3st!${randomBytes(18).toString('base64url')}`;
    const emailA = `phase6.a.${suffix}@gmail.com`;
    const emailB = `phase6.b.${suffix}@gmail.com`;
    for (const email of [emailA, emailB]) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
      userIds.push(data.user.id);
    }
    const [userA, userB] = userIds;
    assert(userA && userB, 'Test users were not created');

    const createOrder = async (
      userId: string,
      label: string,
      status: OrderStatus = OrderStatus.CONFIRMED,
    ): Promise<{ order: Order; cart: Cart; quote: CheckoutQuote }> => {
      const cart = await prisma.cart.create({
        data: {
          userId,
          status: status === OrderStatus.PAYMENT_PENDING ? CartStatus.ACTIVE : CartStatus.CONVERTED,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      cartIds.push(cart.id);
      const quote = await prisma.checkoutQuote.create({
        data: {
          cartId: cart.id,
          userId,
          itemsSnapshot: [{ sku: `P6-${label}`, quantity: 1 }],
          addressSnapshot: {
            recipientName: 'Phase Six Customer',
            email: emailA,
            phone: '9876543210',
          },
          subtotalPaise: 10_000,
          discountPaise: 0,
          shippingPaise: 900,
          taxPaise: 1_800,
          totalPaise: 12_700,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
      quoteIds.push(quote.id);
      const order = await prisma.order.create({
        data: {
          orderNumber: `P6-${label}-${suffix}`,
          quoteId: quote.id,
          cartId: cart.id,
          userId,
          status,
          itemsSnapshot: quote.itemsSnapshot as Prisma.InputJsonValue,
          addressSnapshot: quote.addressSnapshot as Prisma.InputJsonValue,
          subtotalPaise: quote.subtotalPaise,
          discountPaise: quote.discountPaise,
          shippingPaise: quote.shippingPaise,
          taxPaise: quote.taxPaise,
          totalPaise: quote.totalPaise,
          paymentExpiresAt: quote.expiresAt,
        },
      });
      orderIds.push(order.id);
      return { order, cart, quote };
    };

    const owned = await createOrder(userA, 'OWNED');
    const pdf = Buffer.from('%PDF-1.4\n% Phase 6 live invoice\n%%EOF\n');
    invoicePath = `invoices/${owned.order.id}/${randomUUID()}.pdf`;
    const { error: uploadError } = await admin.storage
      .from('private-documents')
      .upload(invoicePath, pdf, { contentType: 'application/pdf', upsert: false });
    if (uploadError) throw uploadError;
    await prisma.invoice.create({
      data: {
        orderId: owned.order.id,
        number: `INV-${owned.order.orderNumber}`,
        storagePath: invoicePath,
        bytes: pdf.length,
        sha256: createHash('sha256').update(pdf).digest('hex'),
      },
    });

    const clientA = createClient(supabaseUrl, required('SUPABASE_ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const clientB = createClient(supabaseUrl, required('SUPABASE_ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const [{ error: loginA }, { error: loginB }] = await Promise.all([
      clientA.auth.signInWithPassword({ email: emailA, password }),
      clientB.auth.signInWithPassword({ email: emailB, password }),
    ]);
    if (loginA) throw loginA;
    if (loginB) throw loginB;
    const [{ data: ownOrders }, { data: otherOrders }, { data: ownInvoices }, signed] =
      await Promise.all([
        clientA.from('orders').select('id').eq('id', owned.order.id),
        clientB.from('orders').select('id').eq('id', owned.order.id),
        clientA.from('invoices').select('id').eq('order_id', owned.order.id),
        admin.storage.from('private-documents').createSignedUrl(invoicePath, 60),
      ]);
    assert(
      ownOrders?.length === 1 &&
        otherOrders?.length === 0 &&
        ownInvoices?.length === 1 &&
        Boolean(signed.data?.signedUrl),
      'Customer order/invoice ownership or private signed access failed',
    );
    console.log('✓ Customer order and private invoice access are owner-scoped');

    await prisma.$executeRaw`select public.transition_order_status(
      ${owned.order.id}::uuid,
      ${'processing'}::public.order_status
    )`;
    let invalidRejected = false;
    try {
      await prisma.$executeRaw`select public.transition_order_status(
        ${owned.order.id}::uuid,
        ${'delivered'}::public.order_status
      )`;
    } catch {
      invalidRejected = true;
    }
    assert(invalidRejected, 'Invalid processing-to-delivered transition was accepted');
    await prisma.$executeRaw`select public.transition_order_status(
      ${owned.order.id}::uuid,
      ${'shipped'}::public.order_status
    )`;
    await prisma.$executeRaw`select public.transition_order_status(
      ${owned.order.id}::uuid,
      ${'delivered'}::public.order_status
    )`;
    console.log('✓ Live order state machine accepts only valid transitions');

    const pending = await createOrder(userA, 'OUTBOX', OrderStatus.PAYMENT_PENDING);
    await prisma.order.update({
      where: { id: pending.order.id },
      data: { status: OrderStatus.CONFIRMED },
    });
    await prisma.order.update({
      where: { id: pending.order.id },
      data: { status: OrderStatus.CONFIRMED },
    });
    const outboxCount = await prisma.outboxEvent.count({
      where: { dedupeKey: `order-confirmed:${pending.order.id}` },
    });
    assert(outboxCount === 1, 'Order confirmation queued more than one outbox event');
    console.log('✓ Confirmation queues exactly one durable outbox event');

    const category = await prisma.category.create({
      data: { name: 'Phase 6 Cancel', slug: `phase6-cancel-${suffix}`, isPublished: true },
    });
    categoryId = category.id;
    const product = await prisma.product.create({
      data: {
        categoryId,
        name: 'Cancellation Product',
        slug: `phase6-cancel-product-${suffix}`,
        status: ProductStatus.PUBLISHED,
        publishedAt: new Date(),
        variants: {
          create: {
            sku: `P6-CANCEL-${suffix}`.toUpperCase(),
            name: 'Cancellation variant',
            pricePaise: 10_000,
          },
        },
      },
      include: { variants: true },
    });
    productId = product.id;
    const variant = product.variants[0];
    assert(variant, 'Cancellation variant missing');
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `P6-${randomBytes(4).toString('hex').toUpperCase()}`,
        name: 'Cancellation Warehouse',
      },
    });
    warehouseId = warehouse.id;
    await prisma.inventoryLevel.create({
      data: { warehouseId, variantId: variant.id, onHand: 4, reserved: 0 },
    });
    const cancellable = await createOrder(userA, 'CANCEL');
    await prisma.inventoryReservation.create({
      data: {
        cartId: cancellable.cart.id,
        variantId: variant.id,
        warehouseId,
        quantity: 1,
        status: ReservationStatus.CONSUMED,
        expiresAt: new Date(),
      },
    });
    await prisma.$executeRaw`select public.cancel_order(${cancellable.order.id}::uuid)`;
    const [cancelled, restored, reservation] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id: cancellable.order.id } }),
      prisma.inventoryLevel.findUniqueOrThrow({
        where: { warehouseId_variantId: { warehouseId, variantId: variant.id } },
      }),
      prisma.inventoryReservation.findFirstOrThrow({
        where: { cartId: cancellable.cart.id },
      }),
    ]);
    assert(
      cancelled.status === OrderStatus.CANCELLED &&
        restored.onHand === 5 &&
        reservation.status === ReservationStatus.RELEASED,
      'Pre-fulfilment cancellation did not restore consumed stock',
    );
    console.log('✓ Pre-fulfilment cancellation restores stock exactly once');
  } finally {
    await prisma.notification.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.outboxEvent.deleteMany({
      where: { aggregateType: 'order', aggregateId: { in: orderIds } },
    });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.stockMovement.deleteMany({
      where: { referenceId: { in: orderIds } },
    });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.checkoutQuote.deleteMany({ where: { id: { in: quoteIds } } });
    await prisma.inventoryReservation.deleteMany({ where: { cartId: { in: cartIds } } });
    await prisma.cartItem.deleteMany({ where: { cartId: { in: cartIds } } });
    await prisma.cart.deleteMany({ where: { id: { in: cartIds } } });
    if (invoicePath) {
      await admin.storage.from('private-documents').remove([invoicePath]);
    }
    if (warehouseId) {
      await prisma.inventoryLevel.deleteMany({ where: { warehouseId } });
      await prisma.warehouse.delete({ where: { id: warehouseId } });
    }
    if (productId) await prisma.product.delete({ where: { id: productId } });
    if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
    for (const userId of userIds) {
      await admin.auth.admin.deleteUser(userId);
    }
    await prisma.$disconnect();
  }
}

void run()
  .then(() => console.log('Phase 6 live verification passed; temporary data was removed.'))
  .catch((error: unknown) => {
    console.error(
      `Phase 6 live verification failed: ${error instanceof Error ? error.message : error}`,
    );
    process.exitCode = 1;
  });
