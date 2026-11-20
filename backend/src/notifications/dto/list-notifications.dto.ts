import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

const toBoolean = ({ value }: { value: unknown }): boolean =>
  value === true || value === 'true' || value === 1 || value === '1';

export class ListNotificationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unread?: boolean;
}
