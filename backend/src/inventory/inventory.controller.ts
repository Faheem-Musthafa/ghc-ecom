import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { AppRole, InventoryLevel, Warehouse } from '@prisma/client';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { SetInventoryDto } from './dto/set-inventory.dto';
import { InventoryService } from './inventory.service';

@Controller('admin/inventory')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(AppRole.ADMIN, AppRole.WAREHOUSE_MANAGER)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Post('warehouses')
  createWarehouse(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: CreateWarehouseDto,
  ): Promise<Warehouse> {
    return this.inventory.createWarehouse(actor.id, input);
  }

  @Put('warehouses/:warehouseId/levels')
  setInventory(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Body() input: SetInventoryDto,
  ): Promise<InventoryLevel> {
    return this.inventory.setInventory(actor.id, warehouseId, input);
  }

  @Get('levels')
  listLevels(): Promise<InventoryLevel[]> {
    return this.inventory.listLevels();
  }

  @Get('warehouses')
  listWarehouses(): Promise<Warehouse[]> {
    return this.inventory.listWarehouses();
  }
}
