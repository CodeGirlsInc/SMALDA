import { Module } from '@nestjs/common';
import { RiskIndicatorModule } from '../risk-indicator/risk-indicator.module';
import { RiskScoreController } from './risk-score.controller';
import { RiskScoreService } from './risk-score.service';

@Module({
  imports: [RiskIndicatorModule],
  controllers: [RiskScoreController],
  providers: [RiskScoreService],
  exports: [RiskScoreService],
})
export class RiskScoreModule {}
