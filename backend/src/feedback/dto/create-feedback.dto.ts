{
  ;`import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsUrl,
  IsObject,
} from 'class-validator';
import { FeedbackType } from '../enums/feedback-type.enum';
import { FeedbackSeverity } from '../enums/feedback-severity.enum'; // New import
import { FeedbackSource } from '../enums/feedback-source.enum'; // New import
import { ApiProperty } from '@nestjs/swagger';

export class CreateFeedbackDto {
  @ApiProperty({ description: 'ID of the user submitting the feedback', required: false, format: 'uuid' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ enum: FeedbackType, description: 'Type of feedback (e.g., bug_report, feature_request)' })
  @IsNotEmpty()
  @IsEnum(FeedbackType)
  feedbackType: FeedbackType;

  @ApiProperty({ description: 'Subject or title of the feedback', maxLength: 255 })
  @IsNotEmpty()
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Detailed message of the feedback' })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiProperty({ enum: FeedbackSeverity, description: 'Severity of the feedback (technical impact)', required: false, default: FeedbackSeverity.LOW })
  @IsOptional()
  @IsEnum(FeedbackSeverity)
  severity?: FeedbackSeverity; // New field

  @ApiProperty({ enum: FeedbackSource, description: 'Source from which the feedback was submitted', required: false, default: FeedbackSource.WEB_APP })
  @IsOptional()
  @IsEnum(FeedbackSource)
  source?: FeedbackSource; // New field

  @ApiProperty({ description: 'Array of URLs for attached files (e.g., screenshots)', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsUrl({ require_tld: false }, { each: true }) // Use require_tld: false for placeholder.svg
  attachments?: string[];

  @ApiProperty({ description: 'Additional metadata (e.g., browser info, app version)', required: false, type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'ID of the user (e.g., admin) to whom this feedback is initially assigned', required: false, format: 'uuid' })
  @IsOptional()
  @IsString()
  assignedTo?: string; // New field
}`
}
