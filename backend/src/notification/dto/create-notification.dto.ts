import { IsString, IsNotEmpty, IsOptional, IsEnum, IsObject, IsDateString, IsEmail } from "class-validator"
import { NotificationType, NotificationPriority, NotificationEvent } from "../entities/notification.entity"

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  recipientId: string

  @IsEmail()
  recipientEmail: string

  @IsEnum(NotificationType)
  type: NotificationType

  @IsEnum(NotificationEvent)
  event: NotificationEvent

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority = NotificationPriority.MEDIUM

  @IsString()
  @IsNotEmpty()
  title: string

  @IsString()
  @IsNotEmpty()
  message: string

  @IsOptional()
  @IsObject()
  data?: Record<string, any>

  @IsOptional()
  @IsString()
  resourceType?: string

  @IsOptional()
  @IsString()
  resourceId?: string

  @IsOptional()
  @IsString()
  senderId?: string

  @IsOptional()
  @IsEmail()
  senderEmail?: string

  @IsOptional()
  @IsString()
  templateId?: string

  @IsOptional()
  @IsDateString()
  scheduledAt?: Date
}
