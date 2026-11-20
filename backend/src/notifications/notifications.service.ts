import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
} from './entities/notification.entity';

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  documentId: string | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    documentId?: string | null,
  ): Promise<NotificationResponse> {
    const notification = this.notificationRepository.create({
      userId,
      type,
      title,
      body,
      documentId: documentId ?? null,
      readAt: null,
    });
    return this.toResponse(await this.notificationRepository.save(notification));
  }

  async findForUser(
    userId: string,
    limit = 20,
    unreadOnly = false,
  ): Promise<NotificationResponse[]> {
    const where: FindOptionsWhere<Notification> = { userId };
    if (unreadOnly) where.readAt = IsNull();

    const notifications = await this.notificationRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return notifications.map((notification) => this.toResponse(notification));
  }

  async countUnread(userId: string): Promise<{ count: number }> {
    const count = await this.notificationRepository.count({
      where: { userId, readAt: IsNull() },
    });
    return { count };
  }

  async markRead(
    userId: string,
    id: string,
  ): Promise<NotificationResponse> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      return this.toResponse(await this.notificationRepository.save(notification));
    }
    return this.toResponse(notification);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationRepository.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return { updated: result.affected ?? 0 };
  }

  private toResponse(notification: Notification): NotificationResponse {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      documentId: notification.documentId ?? null,
      read: Boolean(notification.readAt),
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}
