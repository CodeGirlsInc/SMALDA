import { Controller, Get, Post, Body, Param, Query, Patch, ParseUUIDPipe } from "@nestjs/common"
import type { NotificationService } from "./notification.service"
import type { CreateNotificationDto } from "./dto/create-notification.dto"
import type { NotificationQueryDto } from "./dto/notification-query.dto"
import type { Notification } from "./entities/notification.entity"
import type { NotificationData } from "./interfaces/notification-template.interface"

@Controller("notifications")
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    return await this.notificationService.create(createNotificationDto)
  }

  @Post("send")
  async sendNotification(notificationData: NotificationData): Promise<{ message: string }> {
    await this.notificationService.sendNotification(notificationData)
    return { message: "Notification queued successfully" }
  }

  @Get()
  async findAll(query: NotificationQueryDto): Promise<{
    notifications: Notification[]
    total: number
    limit: number
    offset: number
  }> {
    return await this.notificationService.findAll(query)
  }

  @Get("stats")
  async getStats(recipientId?: string): Promise<{
    total: number
    unread: number
    byStatus: Record<string, number>
    byType: Record<string, number>
    byEvent: Record<string, number>
  }> {
    return await this.notificationService.getNotificationStats(recipientId)
  }

  @Get("recipient/:recipientId")
  async findByRecipient(
    @Param("recipientId") recipientId: string,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
  ): Promise<Notification[]> {
    return await this.notificationService.findByRecipient(recipientId, limit, offset)
  }

  @Get("recipient/:recipientId/unread")
  async findUnreadByRecipient(@Param("recipientId") recipientId: string): Promise<Notification[]> {
    return await this.notificationService.findUnreadByRecipient(recipientId)
  }

  @Get(":id")
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<Notification | null> {
    return await this.notificationService.findOne(id)
  }

  @Patch(":id/read")
  async markAsRead(@Param("id", ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.notificationService.markAsRead(id)
    return { message: "Notification marked as read" }
  }

  @Patch("recipient/:recipientId/read-all")
  async markAllAsRead(@Param("recipientId") recipientId: string): Promise<{ message: string }> {
    await this.notificationService.markAllAsRead(recipientId)
    return { message: "All notifications marked as read" }
  }

  @Post("retry-failed")
  async retryFailedNotifications(): Promise<{ message: string; retryCount: number }> {
    const retryCount = await this.notificationService.retryFailedNotifications()
    return { message: "Failed notifications queued for retry", retryCount }
  }

  @Post("cleanup")
  async cleanupOldNotifications(@Body() body: { daysToKeep: number }): Promise<{ message: string; deletedCount: number }> {
    const daysToKeep = body.daysToKeep || 90
    const deletedCount = await this.notificationService.cleanupOldNotifications(daysToKeep)
    return { message: "Old notifications cleaned up", deletedCount }
  }
}
