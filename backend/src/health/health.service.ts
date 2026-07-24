import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface ReadinessStatus {
  status: 'ok';
  database: 'ok';
  redis: 'ok';
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async readiness(): Promise<ReadinessStatus> {
    try {
      const [, redisResponse] = await Promise.all([
        this.prisma.$queryRaw`SELECT 1`,
        this.redis.ping(),
      ]);

      if (redisResponse !== 'PONG') {
        throw new Error('Redis did not return PONG');
      }

      return { status: 'ok', database: 'ok', redis: 'ok' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        message: 'Dependencies are unavailable',
      });
    }
  }
}
