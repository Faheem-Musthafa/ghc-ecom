import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, ReturnStatus, ShipmentStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { FulfilmentService } from './fulfilment.service';
import { ShippingProviderService } from './shipping-provider.service';

describe('FulfilmentService', () => {
  const order = {
    id: '1b4e28ba-2fa1-11d2-883f-0016d3cca427',
    orderNumber: 'GHC-1',
    status: OrderStatus.PROCESSING,
    itemsSnapshot: [{ variantId: 'variant-1', sku: 'SKU-1', quantity: 1 }],
    addressSnapshot: { city: 'Pune' },
  };
  let prisma: {
    order: { findUnique: jest.Mock };
    shipment: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    returnRequest: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    $executeRaw: jest.Mock;
  };
  let provider: {
    create: jest.Mock;
    items: jest.Mock;
  };
  let audit: { record: jest.Mock };
  let service: FulfilmentService;

  beforeEach(() => {
    prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      shipment: {
        create: jest.fn().mockResolvedValue({ id: 'shipment-1' }),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'shipment-1',
          status: ShipmentStatus.IN_TRANSIT,
        }),
      },
      returnRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'return-1' }),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    provider = {
      create: jest.fn().mockResolvedValue({
        provider: 'test-carrier',
        providerShipmentId: 'provider-1',
        trackingNumber: 'TRACK-1',
      }),
      items: jest.fn().mockReturnValue([{ variantId: 'variant-1', sku: 'SKU-1', quantity: 1 }]),
    };
    audit = { record: jest.fn().mockResolvedValue({}) };
    service = new FulfilmentService(
      prisma as unknown as PrismaService,
      provider as unknown as ShippingProviderService,
      audit as unknown as AuditService,
      {
        getOrThrow: jest.fn().mockReturnValue(30),
      } as unknown as ConfigService,
    );
  });

  it('creates a provider-backed shipment only for a processing order', async () => {
    await service.createShipment('admin-1', order.id, { carrier: 'Carrier' });

    expect(provider.create).toHaveBeenCalledWith(order, 'Carrier');
    expect(prisma.shipment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: order.id,
        provider: 'test-carrier',
        items: { create: [{ variantId: 'variant-1', sku: 'SKU-1', quantity: 1 }] },
      }),
    });
  });

  it('rejects a return outside the thirty-day delivery window', async () => {
    prisma.shipment.findFirst.mockResolvedValue({
      deliveredAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    });

    await expect(
      service.requestReturn('customer-1', order.id, {
        reason: 'The product was damaged during delivery',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.returnRequest.create).not.toHaveBeenCalled();
  });

  it('accepts an eligible return and records its fixed eligibility deadline', async () => {
    const deliveredAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    prisma.shipment.findFirst.mockResolvedValue({ deliveredAt });

    await service.requestReturn('customer-1', order.id, {
      reason: 'The product was damaged during delivery',
    });

    expect(prisma.returnRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: order.id,
        userId: 'customer-1',
        eligibleUntil: new Date(deliveredAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      }),
    });
  });

  it('rejects an invalid return review transition', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue({
      id: 'return-1',
      status: ReturnStatus.REJECTED,
    });

    await expect(
      service.reviewReturn('admin-1', 'return-1', {
        status: ReturnStatus.RECEIVED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
