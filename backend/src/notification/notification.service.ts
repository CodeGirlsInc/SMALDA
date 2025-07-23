import { Injectable, Logger } from "@nestjs/common"
import type { Queue } from "bull"
import type { Repository } from "typeorm"
import { Between, In } from "typeorm"
import type { Notification } from "./entities/notification.entity"
import { NotificationStatus } from "./entities/notification.entity"
import type { CreateNotificationDto } from "./dto/create-notification.dto"
import type { NotificationQueryDto } from "./dto/notification-query.dto"
import type { NotificationData } from "./interfaces/notification-template.interface"

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name)

  constructor(
    private notificationRepository: Repository<Notification>,
    private notificationQueue: Queue,
  ) {}

  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create(createNotificationDto)
    return await this.notificationRepository.save(notification)
  }

  async sendNotification(data: NotificationData): Promise<void> {
    this.logger.log(`Queuing notification for event: ${data.event}`)

    // Determine job priority based on event
    const priority = this.getJobPriority(data.event)

    // Add job to queue
    await this.notificationQueue.add("send-notification", data, {
      priority,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    })
  }

  async queueEmailNotification(notificationId: string): Promise<void> {
    await this.notificationQueue.add(
      "send-email",
      { notificationId },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    )
  }

  async findAll(query: NotificationQueryDto): Promise<{
    notifications: Notification[]
    total: number
    limit: number
    offset: number
  }> {
    const {
      recipientId,
      type,
      status,
      event,
      priority,
      resourceType,
      resourceId,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = query

    const whereConditions: any = {}

    if (recipientId) {
      whereConditions.recipientId = recipientId
    }

    if (type) {
      whereConditions.type = type
    }

    if (status) {
      whereConditions.status = status
    }

    if (event) {
      whereConditions.event = event
    }

    if (priority) {
      whereConditions.priority = priority
    }

    if (resourceType) {
      whereConditions.resourceType = resourceType
    }

    if (resourceId) {
      whereConditions.resourceId = resourceId
    }

    if (startDate && endDate) {
      whereConditions.createdAt = Between(new Date(startDate), new Date(endDate))
    }

    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: whereConditions,
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    })

    return {
      notifications,
      total,
      limit,
      offset,
    }
  }

  async findOne(id: string): Promise<Notification | null> {
    return await this.notificationRepository.findOne({
      where: { id },
    })
  }

  async findByRecipient(recipientId: string, limit = 50, offset = 0): Promise<Notification[]> {
    return await this.notificationRepository.find({
      where: { recipientId },
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    })
  }

  async findUnreadByRecipient(recipientId: string): Promise<Notification[]> {
    return await this.notificationRepository.find({
      where: {
        recipientId,
        status: In([NotificationStatus.PENDING, NotificationStatus.SENT, NotificationStatus.DELIVERED]),
      },
      order: { createdAt: "DESC" },
    })
  }

  async markAsRead(id: string): Promise<void> {
    await this.notificationRepository.update(id, {
      status: NotificationStatus.READ,
      readAt: new Date(),
    })
  }

  async markAllAsRead(recipientId: string): Promise<void> {
    await this.notificationRepository.update(
      {
        recipientId,
        status: In([NotificationStatus.SENT, NotificationStatus.DELIVERED]),
      },
      {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    )
  }

  async updateStatus(id: string, status: NotificationStatus, additionalData?: Partial<Notification>): Promise<void> {
    const updateData: any = { status, ...additionalData }
    await this.notificationRepository.update(id, updateData)
  }

  async incrementRetryCount(id: string): Promise<void> {
    await this.notificationRepository.increment({ id }, "retryCount", 1)
  }

  async getNotificationStats(recipientId?: string): Promise<{
    total: number
    unread: number
    byStatus: Record<string, number>
    byType: Record<string, number>
    byEvent: Record<string, number>
  }> {
    const whereCondition: any = {}
    if (recipientId) {
      whereCondition.recipientId = recipientId
    }

    const notifications = await this.notificationRepository.find({
      where: whereCondition,
    })

    const stats = {
      total: notifications.length,
      unread: notifications.filter((n) =>
        [NotificationStatus.PENDING, NotificationStatus.SENT, NotificationStatus.DELIVERED].includes(n.status),
      ).length,
      byStatus: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      byEvent: {} as Record<string, number>,
    }

    notifications.forEach((notification) => {
      // Count by status
      stats.byStatus[notification.status] = (stats.byStatus[notification.status] || 0) + 1

      // Count by type
      stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1

      // Count by event
      stats.byEvent[notification.event] = (stats.byEvent[notification.event] || 0) + 1
    })

    return stats
  }

  async retryFailedNotifications(): Promise<number> {
    const failedNotifications = await this.notificationRepository.find({
      where: {
        status: NotificationStatus.FAILED,
      },
    })

    let retryCount = 0
    for (const notification of failedNotifications) {
      if (notification.retryCount < notification.maxRetries) {
        await this.notificationQueue.add(
          "retry-failed",
          { notificationId: notification.id },
          {
            delay: 60000, // Retry after 1 minute
          },
        )
        retryCount++
      }
    }

    this.logger.log(`Queued ${retryCount} failed notifications for retry`)
    return retryCount
  }

  async cleanupOldNotifications(daysToKeep = 90): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const result = await this.notificationRepository.delete({
      createdAt: Between(new Date("1970-01-01"), cutoffDate),
      status: In([NotificationStatus.SENT, NotificationStatus.DELIVERED, NotificationStatus.READ]),
    })

    return result.affected || 0
  }

  private getJobPriority(event: string): number {
    // Higher numbers = higher priority in Bull
    switch (event) {
      case "CRITICAL_RISK_DETECTED":
        return 100
      case "HIGH_RISK_DETECTED":
        return 80
      case "RISK_DETECTED":
        return 60
      case "REVIEW_REJECTED":
        return 50
      case "REVIEW_APPROVED":
        return 40
      case "REVIEW_REQUESTED":
        return 30
      default:
        return 20
    }
  }
}
