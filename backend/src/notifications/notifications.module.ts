import { Module } from '@nestjs/common';
import { FulfilmentModule } from '../fulfilment/fulfilment.module';
import { OrdersModule } from '../orders/orders.module';
import { NotificationSenderService } from './notification-sender.service';
import { OutboxQueueService } from './outbox-queue.service';
import { OutboxService } from './outbox.service';

@Module({
  imports: [OrdersModule, FulfilmentModule],
  providers: [NotificationSenderService, OutboxService, OutboxQueueService],
  exports: [OutboxService],
})
export class NotificationsModule {}
