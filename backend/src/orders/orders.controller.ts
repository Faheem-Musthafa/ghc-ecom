import { Controller, Get, Headers, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Order } from '@prisma/client';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { OrderDetail, OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(SupabaseAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<OrderDetail[]> {
    return this.orders.listMine(user.id);
  }

  @Get(':orderId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<OrderDetail> {
    return this.orders.getMine(user.id, orderId);
  }

  @Get(':orderId/invoice')
  invoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<{ url: string; expiresIn: number }> {
    return this.orders.invoiceUrl(user.id, orderId);
  }

  @Post(':orderId/cancel')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<Order> {
    return this.orders.cancelMine(user.id, orderId);
  }
}

@Controller('guest/orders')
export class GuestOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get(':orderId')
  get(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Headers('x-cart-token') guestToken: string,
  ): Promise<OrderDetail> {
    return this.orders.getGuest(orderId, guestToken);
  }

  @Get(':orderId/invoice')
  invoice(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Headers('x-cart-token') guestToken: string,
  ): Promise<{ url: string; expiresIn: number }> {
    return this.orders.guestInvoiceUrl(orderId, guestToken);
  }
}
