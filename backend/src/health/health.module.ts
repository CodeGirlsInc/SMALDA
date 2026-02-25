import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { SystemMetricsService } from './system-metrics.service';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TerminusModule,
    TypeOrmModule,
  ],
  controllers: [HealthController],
  providers: [SystemMetricsService],
  exports: [SystemMetricsService],
})
export class HealthModule {}
