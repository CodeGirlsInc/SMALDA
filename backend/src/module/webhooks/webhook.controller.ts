import { Body, Column, Controller, CreateDateColumn, Delete, Entity, Get, Injectable, Param, Post, Req, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User } from '../../users/entities/user.entity';
import { PrimaryGeneratedColumn } from 'typeorm';

@Entity('webhook_subscriptions')
export class WebhookSubscription {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column() url: string;
  @Column({ type: 'simple-array' }) events: string[];
  @Column({ default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
}

@Injectable()
export class WebhookService {
  constructor(@InjectRepository(WebhookSubscription) private readonly repo: Repository<WebhookSubscription>) {}

  async fire(event: string, payload: Record<string, unknown>) {
    const subs = await this.repo.find({ where: { isActive: true } });
    for (const sub of subs.filter((s) => s.events.includes(event))) {
      fetch(sub.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .catch((err) => console.error(`Webhook delivery failed for ${sub.url}: ${err.message}`));
    }
  }
}

@Controller('module/webhooks')
@UseGuards(JwtAuthGuard)
export class WebhookController {
  constructor(@InjectRepository(WebhookSubscription) private readonly repo: Repository<WebhookSubscription>) {}

  @Post()
  create(@Body() body: { url: string; events: string[] }, @Req() req: { user: User }) {
    return this.repo.save(this.repo.create({ userId: req.user.id, url: body.url, events: body.events }));
  }

  @Get()
  list(@Req() req: { user: User }) {
    return this.repo.find({ where: { userId: req.user.id, isActive: true } });
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: { user: User }) {
    const sub = await this.repo.findOneBy({ id });
    if (!sub) throw new NotFoundException();
    if (sub.userId !== req.user.id) throw new ForbiddenException();
    await this.repo.remove(sub);
    return { message: 'Webhook removed' };
  }
}