import { Controller, Get } from '@nestjs/common';
import { HealthService, ReadinessStatus } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  ready(): Promise<ReadinessStatus> {
    return this.healthService.readiness();
  }
}
