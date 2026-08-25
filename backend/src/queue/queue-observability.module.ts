import { Module } from '@nestjs/common';
import { QueueObservabilityController } from './queue-observability.controller';
import { QueueService } from './queue.service';
import { AuthModule } from '../auth/auth.module';
import { QueueModule } from './queue.module';

@Module({
  imports: [AuthModule, QueueModule],
  controllers: [QueueObservabilityController],
  providers: [QueueService],
})
export class QueueObservabilityModule {}
