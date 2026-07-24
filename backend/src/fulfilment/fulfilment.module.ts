import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { FulfilmentController } from './fulfilment.controller';
import { FulfilmentService } from './fulfilment.service';
import { RefundQueueService } from './refund-queue.service';
import { RefundsService } from './refunds.service';
import { ShippingProviderService } from './shipping-provider.service';

@Module({
  imports: [AuthModule, PaymentsModule],
  controllers: [FulfilmentController],
  providers: [ShippingProviderService, FulfilmentService, RefundsService, RefundQueueService],
  exports: [RefundsService],
})
export class FulfilmentModule {}
