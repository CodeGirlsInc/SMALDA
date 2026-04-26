import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Webhook } from './webhook.entity';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Webhook])],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
