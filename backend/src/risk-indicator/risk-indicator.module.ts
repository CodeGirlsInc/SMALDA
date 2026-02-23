import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiskIndicator } from './entities/risk-indicator.entity';
import { RiskIndicatorController } from './risk-indicator.controller';
import { RiskIndicatorService } from './risk-indicator.service';

@Module({
  imports: [TypeOrmModule.forFeature([RiskIndicator])],
  controllers: [RiskIndicatorController],
  providers: [RiskIndicatorService],
  exports: [RiskIndicatorService],
})
export class RiskIndicatorModule {}
