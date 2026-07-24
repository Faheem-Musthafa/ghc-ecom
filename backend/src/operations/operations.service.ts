import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, OutboxStatus, RefundStatus, WebhookStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { apiServerErrorTotal, operationsGauges, operationsRegistry } from './metrics';

export interface OperationsSnapshot {
  databaseHealthy: boolean;
  apiServerErrorsTotal: number;
  failedWebhooks: number;
  terminalJobFailures: number;
  expiredPendingPayments: number;
  paymentMismatches: number;
  failedRefunds: number;
  lowStockSkus: number;
  checkedAt: string;
}

@Injectable()
export class OperationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OperationsService.name);
  private readonly alertUrl?: string;
  private readonly alertToken?: string;
  private readonly timeoutMs: number;
  private monitor?: NodeJS.Timeout;
  private lastObservedServerErrors = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.alertUrl = config.get<string>('ALERT_WEBHOOK_URL');
    this.alertToken = config.get<string>('ALERT_WEBHOOK_TOKEN');
    this.timeoutMs = config.get<number>('OUTBOUND_TIMEOUT_MS') ?? 10_000;
  }

  onModuleInit(): void {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    this.monitor = setInterval(() => void this.checkAndAlert(), 60_000);
    this.monitor.unref();
  }

  onModuleDestroy(): void {
    if (this.monitor) clearInterval(this.monitor);
  }

  async snapshot(): Promise<OperationsSnapshot> {
    let databaseHealthy = true;
    try {
      await this.prisma.$queryRaw`select 1`;
    } catch {
      databaseHealthy = false;
    }
    const [
      failedWebhooks,
      terminalJobFailures,
      expiredPendingPayments,
      paymentMismatches,
      failedRefunds,
      lowStockSkus,
    ] = await Promise.all([
      this.safeCount(
        this.prisma.webhookEvent.count({
          where: { status: WebhookStatus.FAILED },
        }),
      ),
      this.safeCount(
        this.prisma.outboxEvent.count({
          where: { status: OutboxStatus.FAILED, attempts: { gte: 5 } },
        }),
      ),
      this.safeCount(
        this.prisma.order.count({
          where: {
            status: OrderStatus.PAYMENT_PENDING,
            paymentExpiresAt: { lt: new Date() },
          },
        }),
      ),
      this.safeCount(
        this.prisma.$queryRaw<Array<{ count: bigint }>>`
            select count(*)::bigint as count
            from (
              select o.id::text
              from public.orders o
              where o.status in ('confirmed', 'processing', 'shipped', 'delivered')
                and not exists (
                  select 1 from public.payments p
                  where p.order_id = o.id
                    and p.status in ('captured', 'refunded')
                )
              union all
              select p.id::text
              from public.payments p
              join public.orders o on o.id = p.order_id
              where p.status in ('captured', 'refunded')
                and o.status in ('payment_pending', 'payment_failed')
            ) mismatches
          `.then((rows) => Number(rows[0]?.count ?? 0)),
      ),
      this.safeCount(this.prisma.refund.count({ where: { status: RefundStatus.FAILED } })),
      this.safeCount(
        this.prisma.$queryRaw<Array<{ count: bigint }>>`
            select count(*)::bigint as count
            from public.inventory_levels
            where on_hand - reserved <= low_stock_threshold
          `.then((rows) => Number(rows[0]?.count ?? 0)),
      ),
    ]);
    const snapshot: OperationsSnapshot = {
      databaseHealthy,
      apiServerErrorsTotal: await apiServerErrorTotal(),
      failedWebhooks,
      terminalJobFailures,
      expiredPendingPayments,
      paymentMismatches,
      failedRefunds,
      lowStockSkus,
      checkedAt: new Date().toISOString(),
    };
    this.setGauges(snapshot);
    return snapshot;
  }

  async metrics(): Promise<string> {
    await this.snapshot();
    return operationsRegistry.metrics();
  }

  async checkAndAlert(): Promise<void> {
    const snapshot = await this.snapshot();
    const unhealthy =
      !snapshot.databaseHealthy ||
      snapshot.apiServerErrorsTotal > this.lastObservedServerErrors ||
      snapshot.failedWebhooks > 0 ||
      snapshot.terminalJobFailures > 0 ||
      snapshot.expiredPendingPayments > 0 ||
      snapshot.paymentMismatches > 0 ||
      snapshot.failedRefunds > 0;
    this.lastObservedServerErrors = snapshot.apiServerErrorsTotal;
    if (!unhealthy) return;
    this.logger.error(`Operational alert: ${JSON.stringify(snapshot)}`);
    if (!this.alertUrl) return;
    try {
      const response = await fetch(this.alertUrl, {
        method: 'POST',
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          'content-type': 'application/json',
          ...(this.alertToken ? { authorization: `Bearer ${this.alertToken}` } : {}),
        },
        body: JSON.stringify({ source: 'ghc-ecom-backend', ...snapshot }),
      });
      if (!response.ok) {
        this.logger.error(`Alert delivery failed with status ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`Alert delivery failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  private setGauges(snapshot: OperationsSnapshot): void {
    operationsGauges.databaseHealthy.set(snapshot.databaseHealthy ? 1 : 0);
    operationsGauges.failedWebhooks.set(snapshot.failedWebhooks);
    operationsGauges.terminalJobFailures.set(snapshot.terminalJobFailures);
    operationsGauges.expiredPendingPayments.set(snapshot.expiredPendingPayments);
    operationsGauges.paymentMismatches.set(snapshot.paymentMismatches);
    operationsGauges.failedRefunds.set(snapshot.failedRefunds);
    operationsGauges.lowStockSkus.set(snapshot.lowStockSkus);
  }

  private async safeCount(value: Promise<number>): Promise<number> {
    try {
      return await value;
    } catch {
      return -1;
    }
  }
}
