import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

import { DiskHealthIndicator } from './indicators/disk-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';

@Controller('module/health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly typeOrm: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly disk: DiskHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.typeOrm.pingCheck('postgres', { timeout: 1500 }),
      () => this.redis.checkRedis('redis'),
      () => this.disk.checkDiskSpace('disk'),
    ]);
  }
}
