import { Controller, Delete, Param, Post, Body, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { WebhooksService } from './webhooks.service';

@Controller('cmmty/webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  register(@Req() req: any, @Body() dto: CreateWebhookDto) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not found in request');
    }

    return this.webhooksService.register(userId, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not found in request');
    }

    return this.webhooksService.remove(userId, id);
  }
}
