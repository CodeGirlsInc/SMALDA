import { IsEnum, IsString, IsOptional, IsNumber, IsObject, IsBoolean, Min } from "class-validator"
import { Type } from "class-transformer"
import { ReviewStatus, ReviewDecision, RiskLevel } from "../enums/review.enums"

export class UpdateReviewDto {
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus

  @IsOptional()
  @IsEnum(ReviewDecision)
  decision?: ReviewDecision

  @IsOptional()
  @IsEnum(RiskLevel)
  reviewerRiskLevel?: RiskLevel

  @IsOptional()
  @IsString()
  reviewerNotes?: string

  @IsOptional()
  @IsObject()
  reviewMetadata?: Record<string, any>

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  timeSpentMinutes?: number

  @IsOptional()
  @IsString()
  escalationReason?: string

  @IsOptional()
  @IsBoolean()
  isEscalated?: boolean
}
