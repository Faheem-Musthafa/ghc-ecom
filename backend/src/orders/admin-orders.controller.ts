import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AppRole, Order } from '@prisma/client';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { ListAdminOrdersDto } from './dto/list-admin-orders.dto';
import { TransitionOrderDto } from './dto/transition-order.dto';
import { OrderDetail, OrdersService } from './orders.service';

@Controller('admin/orders')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(AppRole.ADMIN, AppRole.SUPPORT_AGENT, AppRole.WAREHOUSE_MANAGER)
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query() input: ListAdminOrdersDto): Promise<OrderDetail[]> {
    return this.orders.listAdmin(input);
  }

  @Patch(':orderId/status')
  transition(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() input: TransitionOrderDto,
    @Ip() ipAddress: string,
    @Req() request: Request,
  ): Promise<Order> {
    return this.orders.transition(actor.id, orderId, input.status, {
      ipAddress,
      userAgent: request.header('user-agent'),
    });
  }
}
