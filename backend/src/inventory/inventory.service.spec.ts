import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  it('creates zero-stock inventory levels for every existing variant when a warehouse is created', async () => {
    const warehouse = { id: 'warehouse-id', code: 'MAIN', name: 'Main Warehouse' };
    const transaction = {
      warehouse: { create: jest.fn().mockResolvedValue(warehouse) },
      productVariant: {
        findMany: jest.fn().mockResolvedValue([{ id: 'variant-a' }, { id: 'variant-b' }]),
      },
      inventoryLevel: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(transaction)) };
    const audit = { record: jest.fn().mockResolvedValue({ id: 'audit-id' }) };
    const service = new InventoryService(prisma as never, audit as never);

    await expect(
      service.createWarehouse('actor-id', { code: 'main', name: 'Main Warehouse' }),
    ).resolves.toEqual(warehouse);

    expect(transaction.warehouse.create).toHaveBeenCalledWith({
      data: { code: 'MAIN', name: 'Main Warehouse' },
    });
    expect(transaction.inventoryLevel.createMany).toHaveBeenCalledWith({
      data: [
        { warehouseId: 'warehouse-id', variantId: 'variant-a' },
        { warehouseId: 'warehouse-id', variantId: 'variant-b' },
      ],
    });
  });
});
