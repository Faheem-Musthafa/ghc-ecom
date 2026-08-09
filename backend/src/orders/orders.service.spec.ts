import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { InvoiceService } from './invoice.service';
import { OrdersService } from './orders.service';
import { CartService } from '../cart/cart.service';

describe('OrdersService', () => {
  const order = {
    id: '1b4e28ba-2fa1-11d2-883f-0016d3cca427',
    userId: '0f8fad5b-d9cb-469f-a165-70867728950e',
    orderNumber: 'GHC-1',
    status: OrderStatus.CONFIRMED,
    invoice: null,
    payments: [],
  };
  let prisma: {
    order: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    $executeRaw: jest.Mock;
  };
  let audit: { record: jest.Mock };
  let invoices: { signedUrl: jest.Mock };
  let carts: { requireOwnedCart: jest.Mock };
  let service: OrdersService;

  beforeEach(() => {
    prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([order]),
        findFirst: jest.fn().mockResolvedValue(order),
        findUnique: jest.fn().mockResolvedValue(order),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ ...order, status: OrderStatus.PROCESSING }),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    audit = { record: jest.fn().mockResolvedValue({}) };
    invoices = { signedUrl: jest.fn().mockResolvedValue('https://signed.example/invoice') };
    carts = { requireOwnedCart: jest.fn().mockResolvedValue({ id: 'guest-cart' }) };
    service = new OrdersService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      invoices as unknown as InvoiceService,
      carts as unknown as CartService,
    );
  });

  it('allows a guest to retrieve only an order belonging to their cart token', async () => {
    const guestOrder = { ...order, userId: null, cartId: 'guest-cart' };
    prisma.order.findUnique.mockResolvedValue(guestOrder);

    await expect(service.getGuest(guestOrder.id, 'guest-token')).resolves.toBe(guestOrder);
    expect(carts.requireOwnedCart).toHaveBeenCalledWith('guest-cart', undefined, 'guest-token', false);

    carts.requireOwnedCart.mockRejectedValueOnce(new Error('Cart access denied'));
    await expect(service.getGuest(guestOrder.id, 'wrong-token')).rejects.toThrow('Cart access denied');
  });

  it('scopes customer order detail to the authenticated owner', async () => {
    await service.getMine(order.userId, order.id);

    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: order.id, userId: order.userId },
      }),
    );
    prisma.order.findFirst.mockResolvedValue(null);
    await expect(service.getMine('different-customer', order.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('records an audit event for a valid administrative transition', async () => {
    await service.transition('admin-id', order.id, OrderStatus.PROCESSING, {
      ipAddress: '127.0.0.1',
    });

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-id',
        action: 'order.status_changed',
        entityId: order.id,
        metadata: { from: OrderStatus.CONFIRMED, to: OrderStatus.PROCESSING },
      }),
    );
  });

  it('rejects an invalid transition and does not write a misleading audit event', async () => {
    prisma.$executeRaw.mockRejectedValue(
      new Error('invalid order transition from confirmed to delivered'),
    );

    await expect(
      service.transition('admin-id', order.id, OrderStatus.DELIVERED, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('applies admin status, customer, date, and search filters', async () => {
    await service.listAdmin({
      status: OrderStatus.CONFIRMED,
      userId: order.userId,
      search: 'GHC',
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-31T23:59:59.000Z',
      limit: 20,
      offset: 40,
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: OrderStatus.CONFIRMED,
          userId: order.userId,
          createdAt: {
            gte: new Date('2026-07-01T00:00:00.000Z'),
            lte: new Date('2026-07-31T23:59:59.000Z'),
          },
          OR: expect.any(Array),
        }),
        skip: 40,
        take: 20,
      }),
    );
  });
});
