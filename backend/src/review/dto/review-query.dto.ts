import { IsOptional, IsEnum, IsUUID, IsNumber, IsDateString } from "class-validator"
import { Type } from "class-transformer"
import { ReviewStatus, ReviewDecision, RiskLevel } from "../enums/review.enums"

export class ReviewQueryDto {
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus

  @IsOptional()
  @IsEnum(ReviewDecision)
  decision?: ReviewDecision

  @IsOptional()
  @IsEnum(RiskLevel)
  aiRiskLevel?: RiskLevel

  @IsOptional()
  @IsEnum(RiskLevel)
  reviewerRiskLevel?: RiskLevel

  @IsOptional()
  @IsUUID()
  reviewerId?: string

  @IsOptional()
  @IsUUID()
  documentId?: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 10

  @IsOptional()
  @IsDateString()
  createdAfter?: string

  @IsOptional()
  @IsDateString()
  createdBefore?: string

  @IsOptional()
  @IsDateString()
  dueBefore?: string
}
