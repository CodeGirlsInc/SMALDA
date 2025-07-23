import type { NotificationEvent } from "../entities/notification.entity"

export interface NotificationTemplate {
  id: string
  event: NotificationEvent
  title: string
  emailSubject: string
  emailTemplate: string
  inAppTemplate: string
  variables: string[]
}

export interface NotificationData {
  recipientId: string
  recipientEmail: string
  event: NotificationEvent
  data: Record<string, any>
  resourceType?: string
  resourceId?: string
  senderId?: string
  senderEmail?: string
}

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType: string
  }>
}
