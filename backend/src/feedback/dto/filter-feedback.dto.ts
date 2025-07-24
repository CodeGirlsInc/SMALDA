{
  ;`import { IsOptional, IsEnum, IsString, IsNumber, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { FeedbackType } from '../enums/feedback-type.enum';
import { FeedbackStatus } from '../enums/feedback-status.enum';
import { FeedbackPriority } from '../enums/feedback-priority.enum';
import { FeedbackSeverity } from '../enums/feedback-severity.enum'; // New import
import { FeedbackSource } from '../enums/feedback-source.enum'; // New import
import { ApiProperty } from '@nestjs/swagger';

export class FilterFeedbackDto {
  @ApiProperty({ enum: FeedbackType, description: 'Filter by feedback type', required: false })
  @IsOptional()
  @IsEnum(FeedbackType)
  feedbackType?: FeedbackType;

  @ApiProperty({ enum: FeedbackStatus, description: 'Filter by feedback status', required: false })
  @IsOptional()
  @IsEnum(FeedbackStatus)
  status?: FeedbackStatus;

  @ApiProperty({ enum: FeedbackPriority, description: 'Filter by feedback priority', required: false })
  @IsOptional()
  @IsEnum(FeedbackPriority)
  priority?: FeedbackPriority;

  @ApiProperty({ enum: FeedbackSeverity, description: 'Filter by feedback severity', required: false })
  @IsOptional()
  @IsEnum(FeedbackSeverity)
  severity?: FeedbackSeverity; // New filter

  @ApiProperty({ enum: FeedbackSource, description: 'Filter by feedback source', required: false })
  @IsOptional()
  @IsEnum(FeedbackSource)
  source?: FeedbackSource; // New filter

  @ApiProperty({ description: 'Filter by user ID', required: false, format: 'uuid' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: 'Filter by assigned user ID', required: false, format: 'uuid' })
  @IsOptional()
  @IsString()
  assignedTo?: string; // New filter

  @ApiProperty({ description: 'Filter by creation date (start date)', required: false, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'Filter by creation date (end date)', required: false, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'Page number for pagination', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiProperty({ description: 'Number of items per page', required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({ description: 'Field to sort by (e.g., createdAt, priority)', required: false, default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({ enum: ['ASC', 'DESC'], description: 'Sort order (ASC or DESC)', required: false, default: 'DESC' })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  @ApiProperty({ description: 'Search term for subject or message', required: false })
  @IsOptional()
  @IsString()
  search?: string;
}`
}
