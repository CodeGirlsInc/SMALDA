import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [MetricsController],
})
export class MetricsModule {}
