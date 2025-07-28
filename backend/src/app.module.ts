import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CourtCasesModule } from './court-cases/court-cases.module';

@Module({
  imports: [CourtCasesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
