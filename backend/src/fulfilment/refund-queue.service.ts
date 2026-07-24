import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { RefundsService } from './refunds.service';

interface RefundJob {
  kind: 'reconcile';
}

@Injectable()
export class RefundQueueService implements OnModuleInit, OnModuleDestroy {
  private connection?: Redis;
  private queue?: Queue<RefundJob>;
  private worker?: Worker<RefundJob>;

  constructor(
    private readonly config: ConfigService,
    private readonly refunds: RefundsService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    this.connection = new Redis(this.config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue<RefundJob>('refunds', {
      connection: this.connection,
    });
    this.worker = new Worker<RefundJob>(
      'refunds',
      () => this.refunds.reconcilePending().then(() => undefined),
      { connection: this.connection, concurrency: 2 },
    );
    await this.queue.upsertJobScheduler(
      'refund-reconciliation',
      { every: 5 * 60 * 1000 },
      { name: 'reconcile', data: { kind: 'reconcile' } },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }
}
