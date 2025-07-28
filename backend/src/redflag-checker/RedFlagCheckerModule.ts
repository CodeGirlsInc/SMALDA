import { Module } from '@nestjs/common';
import { RedFlagCheckerService } from './RedFlagCheckerService';
import { RedFlagCheckerController } from './RedFlagCheckerController';

@Module({
  controllers: [RedFlagCheckerController],
  providers: [RedFlagCheckerService],
})
export class RedFlagCheckerModule {}
