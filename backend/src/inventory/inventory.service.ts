import { ConflictException, Injectable } from '@nestjs/common';
import { InventoryLevel, StockMovementType, Warehouse } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { auditChangeMetadata } from '../audit/audit-change';
import { PUBLIC_CATALOGUE_CACHE_VERSION_KEY } from '../catalogue/catalogue.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { SetInventoryDto } from './dto/set-inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly redis?: RedisService,
  ) {}

  async createWarehouse(actorId: string, input: CreateWarehouseDto): Promise<Warehouse> {
    const warehouse = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.warehouse.create({
        data: { ...input, code: input.code.toUpperCase() },
      });
      const variants = await transaction.productVariant.findMany({ select: { id: true } });
      if (variants.length > 0) {
        await transaction.inventoryLevel.createMany({
          data: variants.map((variant) => ({
            warehouseId: created.id,
            variantId: variant.id,
          })),
        });
      }
      return created;
    });
    await this.audit.record({
      actorId,
      action: 'inventory.warehouse.created',
      entityType: 'warehouse',
      entityId: warehouse.id,
      metadata: auditChangeMetadata(warehouse.name, {}, warehouse, ['code', 'name', 'isActive']),
    });
    await this.invalidateCatalogue();
    return warehouse;
  }

  async setInventory(
    actorId: string,
    warehouseId: string,
    input: SetInventoryDto,
  ): Promise<InventoryLevel> {
    const { level, previous } = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.inventoryLevel.findUnique({
        where: {
          warehouseId_variantId: {
            warehouseId,
            variantId: input.variantId,
          },
        },
      });
      if (existing && input.onHand < existing.reserved) {
        throw new ConflictException('On-hand stock cannot be lower than reserved stock');
      }
      const saved = await transaction.inventoryLevel.upsert({
        where: {
          warehouseId_variantId: {
            warehouseId,
            variantId: input.variantId,
          },
        },
        create: {
          warehouseId,
          variantId: input.variantId,
          onHand: input.onHand,
          lowStockThreshold: input.lowStockThreshold,
        },
        update: {
          onHand: input.onHand,
          lowStockThreshold: input.lowStockThreshold,
        },
      });
      const difference = input.onHand - (existing?.onHand ?? 0);
      if (difference !== 0) {
        await transaction.stockMovement.create({
          data: {
            warehouseId,
            variantId: input.variantId,
            type: StockMovementType.ADJUSTMENT,
            quantity: difference,
            actorId,
            referenceType: 'inventory_level',
            referenceId: saved.id,
          },
        });
      }
      return { level: saved, previous: existing };
    });
    await this.audit.record({
      actorId,
      action: 'inventory.level.set',
      entityType: 'inventory_level',
      entityId: level.id,
      metadata: {
        ...auditChangeMetadata(
          `Variant ${input.variantId} · Warehouse ${warehouseId}`,
          previous ?? {},
          level,
          ['onHand', 'reserved', 'lowStockThreshold'],
        ),
        warehouseId,
        variantId: input.variantId,
      },
    });
    await this.invalidateCatalogue();
    return level;
  }

  listLevels(): Promise<InventoryLevel[]> {
    return this.prisma.inventoryLevel.findMany({
      orderBy: [{ warehouseId: 'asc' }, { variantId: 'asc' }],
    });
  }

  listWarehouses(): Promise<Warehouse[]> {
    return this.prisma.warehouse.findMany({ orderBy: { code: 'asc' } });
  }

  private async invalidateCatalogue(): Promise<void> {
    try {
      await this.redis?.increment(PUBLIC_CATALOGUE_CACHE_VERSION_KEY);
    } catch {
      // Inventory writes remain authoritative when the cache is unavailable.
    }
  }
}
