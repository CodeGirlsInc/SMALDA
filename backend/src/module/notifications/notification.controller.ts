import { Controller, Get, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User } from '../../users/entities/user.entity';

export enum NotificationType { DOCUMENT_VERIFIED = 'DOCUMENT_VERIFIED', DOCUMENT_FLAGGED = 'DOCUMENT_FLAGGED', DISPUTE_UPDATED = 'DISPUTE_UPDATED' }

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column() message: string;
  @Column({ type: 'enum', enum: NotificationType }) type: NotificationType;
  @Column({ default: false }) isRead: boolean;
  @Column({ nullable: true }) resourceId: string;
  @Column({ nullable: true }) resourceType: string;
  @CreateDateColumn() createdAt: Date;
}

@Controller('module/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(@InjectRepository(Notification) private readonly repo: Repository<Notification>) {}

  @Get()
  list(@Req() req: { user: User }) {
    return this.repo.find({ where: { userId: req.user.id }, order: { createdAt: 'DESC' } });
  }

  @Get('unread-count')
  async unreadCount(@Req() req: { user: User }) {
    const count = await this.repo.count({ where: { userId: req.user.id, isRead: false } });
    return { count };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    await this.repo.update(id, { isRead: true });
    return this.repo.findOneByOrFail({ id });
  }
}