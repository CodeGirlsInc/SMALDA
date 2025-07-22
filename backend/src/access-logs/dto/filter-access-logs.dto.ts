import { IsOptional, IsUUID, IsDateString, IsString, IsNumber, Min } from "class-validator"
import { Transform, Type } from "class-transformer"

export class FilterAccessLogsDto {
  @IsOptional()
  @IsUUID()
  userId?: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @IsString()
  routePath?: string

  @IsOptional()
  @IsString()
  httpMethod?: string

  @IsOptional()
  @IsString()
  ipAddress?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 50

  @IsOptional()
  @Transform(({ value }) => value === "true")
  sortByDateDesc?: boolean = true
}
