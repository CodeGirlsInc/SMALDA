{
  ;`import { PartialType } from '@nestjs/swagger';
import { CreateFeedbackDto } from './create-feedback.dto';
import { IsEnum, IsOptional, IsString, IsDateString, IsArray, IsUrl, IsObject } from 'class-validator';
import { FeedbackStatus } from '../enums/feedback-status.enum';
import { FeedbackPriority } from '../enums/feedback-priority.enum';
import { FeedbackSeverity } from '../enums/feedback-severity.enum'; // New import
import { FeedbackSource } from '../enums/feedback-source.enum'; // New import
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFeedbackDto extends PartialType(CreateFeedbackDto) {
  @ApiProperty({ enum: FeedbackStatus, description: 'New status of the feedback', required: false })
  @IsOptional()
  @IsEnum(FeedbackStatus)
  status?: FeedbackStatus;

  @ApiProperty({ enum: FeedbackPriority, description: 'New priority of the feedback', required: false })
  @IsOptional()
  @IsEnum(FeedbackPriority)
  priority?: FeedbackPriority;

  @ApiProperty({ enum: FeedbackSeverity, description: 'New severity of the feedback', required: false })
  @IsOptional()
  @IsEnum(FeedbackSeverity)
  severity?: FeedbackSeverity; // New field

  @ApiProperty({ enum: FeedbackSource, description: 'New source of the feedback', required: false })
  @IsOptional()
  @IsEnum(FeedbackSource)
  source?: FeedbackSource; // New field

  @ApiProperty({ description: 'ID of the user who resolved the feedback', required: false, format: 'uuid' })
  @IsOptional()
  @IsString()
  resolvedBy?: string;

  @ApiProperty({ description: 'Timestamp when the feedback was resolved', required: false, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  resolvedAt?: Date;

  @ApiProperty({ description: 'Detailed notes on how the feedback was resolved', required: false })
  @IsOptional()
  @IsString()
  resolutionNotes?: string; // New field

  @ApiProperty({ description: 'ID of the user (e.g., admin) assigned to handle this feedback', required: false, format: 'uuid' })
  @IsOptional()
  @IsString()
  assignedTo?: string; // New field

  @ApiProperty({ description: 'Updated subject of the feedback', required: false, maxLength: 255 })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ description: 'Updated message of the feedback', required: false })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ description: 'Updated array of URLs for attached files', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsUrl({ require_tld: false }, { each: true })
  attachments?: string[];

  @ApiProperty({ description: 'Updated additional metadata', required: false, type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}`
}
