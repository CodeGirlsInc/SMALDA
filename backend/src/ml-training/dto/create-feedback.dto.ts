import { IsEnum, IsNumber, IsOptional, IsString, IsBoolean, IsObject, IsUUID, Min, Max } from "class-validator"
import { FeedbackType, FeedbackSource } from "../entities/feedback.entity"

export class CreateFeedbackDto {
  @IsOptional()
  @IsEnum(FeedbackType)
  type?: FeedbackType

  @IsOptional()
  @IsEnum(FeedbackSource)
  source?: FeedbackSource

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number

  @IsOptional()
  @IsString()
  comments?: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>

  @IsOptional()
  @IsUUID()
  submittedBy?: string

  @IsOptional()
  @IsString()
  submitterName?: string

  @IsOptional()
  @IsBoolean()
  isUsefulForTraining?: boolean
}
