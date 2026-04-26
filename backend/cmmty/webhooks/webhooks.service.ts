import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { createHmac, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { Webhook } from './webhook.entity';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(Webhook)
    private readonly webhookRepository: Repository<Webhook>,
  ) {}

  async register(userId: string, dto: CreateWebhookDto): Promise<Webhook> {
    const webhook = this.webhookRepository.create({
      userId,
      url: dto.url,
      events: dto.events,
      secret: dto.secret ?? randomBytes(32).toString('hex'),
      isActive: true,
    });

    return this.webhookRepository.save(webhook);
  }

  async remove(userId: string, id: string): Promise<{ message: string }> {
    const result = await this.webhookRepository.delete({ id, userId });
    if (!result.affected) {
      throw new NotFoundException('Webhook not found');
    }

    return { message: 'Webhook removed successfully' };
  }

  signPayload(payload: Record<string, unknown>, secret: string): string {
    return createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  }

  async deliverEvent(event: string, payload: Record<string, unknown>): Promise<void> {
    const allActiveWebhooks = await this.webhookRepository.find({ where: { isActive: true } });
    const subscribedWebhooks = allActiveWebhooks.filter((webhook) => webhook.events.includes(event));

    await Promise.all(subscribedWebhooks.map((webhook) => this.deliverWithRetry(webhook, event, payload)));
  }

  private async deliverWithRetry(
    webhook: Webhook,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const body = {
      event,
      payload,
      timestamp: new Date().toISOString(),
    };

    const signature = this.signPayload(body, webhook.secret);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await axios.post(webhook.url, body, {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
            'X-SMALDA-Event': event,
            'X-SMALDA-Signature': `sha256=${signature}`,
          },
        });
        return;
      } catch (error) {
        if (attempt === 3) {
          this.logger.error(`Failed to deliver webhook ${webhook.id} after 3 attempts`);
        }
      }
    }
  }
}
