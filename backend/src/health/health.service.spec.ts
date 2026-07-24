import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports ready when Postgres and Redis are available', async () => {
    const service = new HealthService(
      { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as never,
      { ping: jest.fn().mockResolvedValue('PONG') } as never,
    );

    await expect(service.readiness()).resolves.toEqual({
      status: 'ok',
      database: 'ok',
      redis: 'ok',
    });
  });

  it('fails readiness when a dependency is unavailable', async () => {
    const service = new HealthService(
      { $queryRaw: jest.fn().mockRejectedValue(new Error('database unavailable')) } as never,
      { ping: jest.fn().mockResolvedValue('PONG') } as never,
    );

    await expect(service.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
