import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { QueueModule } from '../../queue/queue.module';
import { HealthController } from './health.controller';
import { DiskHealthIndicator } from './indicators/disk-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';

@Module({
  imports: [TerminusModule, QueueModule],
  controllers: [HealthController],
  providers: [DiskHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
