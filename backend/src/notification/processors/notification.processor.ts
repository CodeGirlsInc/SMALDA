import { Processor, Process } from "@nestjs/bull"
import type { Job } from "bull"
import { Injectable, Logger } from "@nestjs/common"
import type { NotificationService } from "../notification.service"
import type { EmailService } from "../services/email.service"
import type { TemplateService } from "../services/template.service"
import { NotificationType, NotificationStatus } from "../entities/notification.entity"
import type { NotificationData } from "../interfaces/notification-template.interface"

@Injectable()
@Processor("notification")
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name)

  constructor(
    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
  ) {}

  @Process("send-notification")
  async handleSendNotification(job: Job<NotificationData>) {
    const { data } = job
    this.logger.log(`Processing notification job for event: ${data.event}`)

    try {
      // Create notification records
      const notifications = await this.createNotifications(data)

      // Process each notification
      for (const notification of notifications) {
        await this.processNotification(notification)
      }

      this.logger.log(`Successfully processed notification job for event: ${data.event}`)
    } catch (error) {
      this.logger.error(`Failed to process notification job:`, error)
      throw error
    }
  }

  @Process("send-email")
  async handleSendEmail(job: Job<{ notificationId: string }>) {
    const { notificationId } = job.data
    this.logger.log(`Processing email job for notification: ${notificationId}`)

    try {
      const notification = await this.notificationService.findOne(notificationId)
      if (!notification) {
        throw new Error(`Notification ${notificationId} not found`)
      }

      if (notification.type !== NotificationType.EMAIL) {
        throw new Error(`Notification ${notificationId} is not an email notification`)
      }

      // Get template
      const template = this.templateService.getTemplate(notification.event)
      if (!template) {
        throw new Error(`Template not found for event: ${notification.event}`)
      }

      // Render email content
      const emailData = {
        recipientName: notification.data?.recipientName || notification.recipientEmail,
        ...notification.data,
      }

      const emailSubject = this.templateService.renderTemplate(template.emailSubject, emailData)
      const emailHtml = this.templateService.renderTemplate(template.emailTemplate, emailData)

      // Send email
      const result = await this.emailService.sendEmail({
        to: notification.recipientEmail,
        subject: emailSubject,
        html: emailHtml,
      })

      // Update notification status
      if (result.success) {
        await this.notificationService.updateStatus(notificationId, NotificationStatus.SENT, {
          sentAt: new Date(),
          messageId: result.messageId,
        })
        this.logger.log(`Email sent successfully for notification: ${notificationId}`)
      } else {
        await this.notificationService.updateStatus(notificationId, NotificationStatus.FAILED, {
          errorMessage: result.error,
        })
        this.logger.error(`Failed to send email for notification: ${notificationId}`, result.error)
      }
    } catch (error) {
      this.logger.error(`Failed to process email job:`, error)

      // Update notification status to failed
      try {
        await this.notificationService.updateStatus(notificationId, NotificationStatus.FAILED, {
          errorMessage: error.message,
        })
      } catch (updateError) {
        this.logger.error(`Failed to update notification status:`, updateError)
      }

      throw error
    }
  }

  @Process("retry-failed")
  async handleRetryFailed(job: Job<{ notificationId: string }>) {
    const { notificationId } = job.data
    this.logger.log(`Retrying failed notification: ${notificationId}`)

    try {
      const notification = await this.notificationService.findOne(notificationId)
      if (!notification) {
        throw new Error(`Notification ${notificationId} not found`)
      }

      if (notification.retryCount >= notification.maxRetries) {
        this.logger.warn(`Max retries exceeded for notification: ${notificationId}`)
        return
      }

      // Increment retry count
      await this.notificationService.incrementRetryCount(notificationId)

      // Requeue based on notification type
      if (notification.type === NotificationType.EMAIL) {
        await this.notificationService.queueEmailNotification(notificationId)
      }

      this.logger.log(`Requeued notification for retry: ${notificationId}`)
    } catch (error) {
      this.logger.error(`Failed to retry notification:`, error)
      throw error
    }
  }

  private async createNotifications(data: NotificationData) {
    const template = this.templateService.getTemplate(data.event)
    if (!template) {
      throw new Error(`Template not found for event: ${data.event}`)
    }

    const notifications = []

    // Create email notification
    const emailNotification = await this.notificationService.create({
      recipientId: data.recipientId,
      recipientEmail: data.recipientEmail,
      type: NotificationType.EMAIL,
      event: data.event,
      title: template.title,
      message: this.templateService.renderTemplate(template.inAppTemplate, data.data),
      data: data.data,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      senderId: data.senderId,
      senderEmail: data.senderEmail,
      templateId: template.id,
    })
    notifications.push(emailNotification)

    // Create in-app notification
    const inAppNotification = await this.notificationService.create({
      recipientId: data.recipientId,
      recipientEmail: data.recipientEmail,
      type: NotificationType.IN_APP,
      event: data.event,
      title: template.title,
      message: this.templateService.renderTemplate(template.inAppTemplate, data.data),
      data: data.data,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      senderId: data.senderId,
      senderEmail: data.senderEmail,
      templateId: template.id,
    })
    notifications.push(inAppNotification)

    return notifications
  }

  private async processNotification(notification: any) {
    if (notification.type === NotificationType.EMAIL) {
      // Queue email for sending
      await this.notificationService.queueEmailNotification(notification.id)
    } else if (notification.type === NotificationType.IN_APP) {
      // In-app notifications are immediately available
      await this.notificationService.updateStatus(notification.id, NotificationStatus.SENT, {
        sentAt: new Date(),
      })
    }
  }
}
