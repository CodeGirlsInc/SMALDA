import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { UserActivityAction } from '../user-activity.entity';

export class ActivityQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(Object.values(UserActivityAction))
  action?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 10;
}
