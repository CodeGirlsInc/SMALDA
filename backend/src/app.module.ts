 import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TimelineGeneratorModule } from './timeline/timeline.module';
import { RiskModule } from './risk/risk.module';

@Module({
  imports: [
    TimelineGeneratorModule,
    RiskModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}