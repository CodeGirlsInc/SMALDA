import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiKeyModule } from './api-key/api-key.module';
import { ExternalApiModule } from './external-api/external-api.module';

@Module({
  imports: [ScheduleModule.forRoot(), ApiKeyModule, ExternalApiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
