import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { OutboxService } from './outbox.service';

interface OutboxJob {
  kind: 'dispatch';
}

@Injectable()
export class OutboxQueueService implements OnModuleInit, OnModuleDestroy {
  private connection?: Redis;
  private queue?: Queue<OutboxJob>;
  private worker?: Worker<OutboxJob>;

  constructor(
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('NODE_ENV') === 'test') {
      return;
    }
    this.connection = new Redis(this.config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue<OutboxJob>('outbox', { connection: this.connection });
    this.worker = new Worker<OutboxJob>('outbox', () => this.process(), {
      connection: this.connection,
      concurrency: 2,
    });
    await this.queue.upsertJobScheduler(
      'outbox-dispatch',
      { every: 30_000 },
      { name: 'dispatch', data: { kind: 'dispatch' } },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  private async process(): Promise<void> {
    await this.outbox.processPending();
  }
}
