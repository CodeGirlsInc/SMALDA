import { IsOptional, IsEnum, IsString, IsDateString, IsNumber, Min, Max } from "class-validator"
import { Transform } from "class-transformer"
import {
  NotificationType,
  NotificationStatus,
  NotificationEvent,
  NotificationPriority,
} from "../entities/notification.entity"

export class NotificationQueryDto {
  @IsOptional()
  @IsString()
  recipientId?: string

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType

  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus

  @IsOptional()
  @IsEnum(NotificationEvent)
  event?: NotificationEvent

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority

  @IsOptional()
  @IsString()
  resourceType?: string

  @IsOptional()
  @IsString()
  resourceId?: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50

  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value))
  @IsNumber()
  @Min(0)
  offset?: number = 0
}
