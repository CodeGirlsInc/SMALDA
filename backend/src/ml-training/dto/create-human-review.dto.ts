import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsObject, Min, Max } from "class-validator"
import { ReviewStatus, ReviewDecision } from "../entities/human-review.entity"
import { RiskLevel } from "../entities/dataset-record.entity"

export class CreateHumanReviewDto {
  @IsString()
  reviewerId: string

  @IsString()
  reviewerName: string

  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus

  @IsOptional()
  @IsEnum(ReviewDecision)
  decision?: ReviewDecision

  @IsOptional()
  @IsEnum(RiskLevel)
  reviewedRiskLevel?: RiskLevel

  @IsOptional()
  @IsString()
  comments?: string

  @IsOptional()
  @IsObject()
  corrections?: Record<string, any>

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  qualityRating?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSpentMinutes?: number

  @IsOptional()
  @IsBoolean()
  requiresSecondReview?: boolean
}
