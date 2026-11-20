import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';

/** Channels for one notification type. */
export class NotificationChannelsDto {
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  inApp?: boolean;
}

/**
 * Body of `PATCH /users/me/notification-preferences`. Keys are the
 * notification types; the global ValidationPipe (`forbidNonWhitelisted`)
 * rejects any other key.
 */
export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  risk_alert?: NotificationChannelsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  verification_complete?: NotificationChannelsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  dispute_update?: NotificationChannelsDto;
}
