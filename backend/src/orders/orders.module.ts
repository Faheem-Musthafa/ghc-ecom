import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { AdminOrdersController } from './admin-orders.controller';
import { InvoiceService } from './invoice.service';
import { GuestOrdersController, OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule, CartModule],
  controllers: [OrdersController, GuestOrdersController, AdminOrdersController],
  providers: [InvoiceService, OrdersService],
  exports: [InvoiceService, OrdersService],
})
export class OrdersModule {}
