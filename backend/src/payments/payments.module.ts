import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { FssController } from './fss/fss.controller';
import { FssGatewayService } from './fss/fss-gateway.service';
import { FssPaymentsService } from './fss/fss-payments.service';
import { PaymentAdminController } from './payment-admin.controller';
import { PaymentQueueService } from './payment-queue.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';
import { WebhookProcessorService } from './webhook-processor.service';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [AuthModule, CartModule],
  controllers: [PaymentsController, WebhooksController, PaymentAdminController, FssController],
  providers: [
    RazorpayService,
    FssGatewayService,
    FssPaymentsService,
    PaymentsService,
    WebhookProcessorService,
    PaymentQueueService,
    WebhooksService,
  ],
  exports: [PaymentsService, RazorpayService, FssPaymentsService],
})
export class PaymentsModule {}
