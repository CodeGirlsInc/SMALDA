import { Module } from '@nestjs/common';
import { QueueObservabilityController } from './queue-observability.controller';

@Module({
  controllers: [QueueObservabilityController],
})
export class QueueObservabilityModule {}
