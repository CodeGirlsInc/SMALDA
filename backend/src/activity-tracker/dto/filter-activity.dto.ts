import { IsOptional, IsEnum, IsString, IsNumber, Min, Max, IsUUID, IsDateString } from "class-validator"
import { Type } from "class-transformer"
import { ActivityAction } from "../enums/activity-action.enum"
import { ApiProperty } from "@nestjs/swagger"

export class FilterActivityDto {
  @ApiProperty({ description: "Filter by user ID", required: false, format: "uuid" })
  @IsOptional()
  @IsUUID()
  userId?: string

  @ApiProperty({ enum: ActivityAction, description: "Filter by action type", required: false })
  @IsOptional()
  @IsEnum(ActivityAction)
  actionType?: ActivityAction

  @ApiProperty({ description: "Filter by activity timestamp (start date)", required: false, format: "date-time" })
  @IsOptional()
  @IsDateString()
  startDate?: string

  @ApiProperty({ description: "Filter by activity timestamp (end date)", required: false, format: "date-time" })
  @IsOptional()
  @IsDateString()
  endDate?: string

  @ApiProperty({ description: "Page number for pagination", required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number

  @ApiProperty({ description: "Number of items per page", required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number

  @ApiProperty({ description: "Field to sort by (e.g., timestamp, userId)", required: false, default: "timestamp" })
  @IsOptional()
  @IsString()
  sortBy?: string

  @ApiProperty({ enum: ["ASC", "DESC"], description: "Sort order (ASC or DESC)", required: false, default: "DESC" })
  @IsOptional()
  @IsEnum(["ASC", "DESC"])
  sortOrder?: "ASC" | "DESC"
}
