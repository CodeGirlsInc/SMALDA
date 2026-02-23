import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  Get,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';

@Controller('api/webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  subscribe(@Body() dto: CreateWebhookDto) {
    return this.webhookService.subscribe(dto);
  }

  @Delete(':id')
  unsubscribe(@Param('id') id: string) {
    return this.webhookService.unsubscribe(id);
  }

  @Get()
  findAll() {
    return this.webhookService['subscriptionRepo'].find();
  }
}