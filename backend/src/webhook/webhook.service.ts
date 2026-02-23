import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(WebhookSubscription)
    private subscriptionRepo: Repository<WebhookSubscription>,

    @InjectRepository(WebhookDelivery)
    private deliveryRepo: Repository<WebhookDelivery>,
  ) {}

  async subscribe(dto: CreateWebhookDto) {
    const secret = crypto.randomBytes(32).toString('hex');

    const subscription = this.subscriptionRepo.create({
      ...dto,
      secret,
      isActive: true,
    });

    return this.subscriptionRepo.save(subscription);
  }

  async unsubscribe(id: string) {
    await this.subscriptionRepo.update(id, { isActive: false });
  }

  async dispatch(event: string, payload: any) {
    const subscriptions = await this.subscriptionRepo
      .createQueryBuilder('s')
      .where(':event = ANY(s.events)', { event })
      .andWhere('s.isActive = true')
      .getMany();

    for (const subscription of subscriptions) {
      await this.deliver(subscription, event, payload);
    }
  }

  private async deliver(
    subscription: WebhookSubscription,
    event: string,
    payload: any,
  ) {
    const body = JSON.stringify(payload);

    const signature = crypto
      .createHash('sha256')
      .update(subscription.secret + body)
      .digest('hex');

    const delivery = this.deliveryRepo.create({
      subscriptionId: subscription.id,
      event,
      payload,
    });

    try {
      const response = await axios.post(subscription.url, payload, {
        headers: {
          'X-SMALDA-Signature': signature,
        },
        timeout: 5000,
      });

      delivery.responseStatus = response.status;
      delivery.success = true;
      delivery.deliveredAt = new Date();
    } catch (error: any) {
      this.logger.error(
        `Webhook delivery failed for ${subscription.id}`,
        error.message,
      );

      delivery.success = false;
      delivery.errorMessage = error.message;
      delivery.responseStatus = error.response?.status ?? null;
      delivery.deliveredAt = new Date();
    }

    await this.deliveryRepo.save(delivery);
  }
}