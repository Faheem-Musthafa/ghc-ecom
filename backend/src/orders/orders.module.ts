import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminOrdersController } from './admin-orders.controller';
import { InvoiceService } from './invoice.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [InvoiceService, OrdersService],
  exports: [InvoiceService, OrdersService],
})
export class OrdersModule {}
