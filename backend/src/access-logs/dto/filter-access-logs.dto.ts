import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterAccessLogsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  sortByDateDesc?: boolean = true;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  routePath?: string;

  @IsOptional()
  @IsEnum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  httpMethod?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
