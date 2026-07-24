import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnvironment } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { CartModule } from './cart/cart.module';
import { CheckoutModule } from './checkout/checkout.module';
import { InventoryModule } from './inventory/inventory.module';
import { PromotionsModule } from './promotions/promotions.module';
import { PaymentsModule } from './payments/payments.module';
import { OrdersModule } from './orders/orders.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FulfilmentModule } from './fulfilment/fulfilment.module';
import { OperationsModule } from './operations/operations.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.getOrThrow<number>('RATE_LIMIT_TTL_MS'),
          limit: config.getOrThrow<number>('RATE_LIMIT_LIMIT'),
        },
      ],
    }),
    DatabaseModule,
    RedisModule,
    SupabaseModule,
    AuditModule,
    AuthModule,
    CustomersModule,
    AdminModule,
    CatalogueModule,
    CartModule,
    CheckoutModule,
    InventoryModule,
    PromotionsModule,
    PaymentsModule,
    OrdersModule,
    NotificationsModule,
    FulfilmentModule,
    OperationsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
