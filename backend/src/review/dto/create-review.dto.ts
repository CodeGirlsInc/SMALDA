import { IsUUID, IsEnum, IsNumber, IsObject, IsOptional, Min, Max } from "class-validator"
import { Type } from "class-transformer"
import { RiskLevel } from "../enums/review.enums"

export class CreateReviewDto {
  @IsUUID()
  documentId: string

  @IsUUID()
  reviewerId: string

  @IsEnum(RiskLevel)
  aiRiskLevel: RiskLevel

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  @Type(() => Number)
  aiConfidenceScore: number

  @IsObject()
  aiDetectionDetails: Record<string, any>

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  priorityLevel?: number

  @IsOptional()
  @Type(() => Date)
  dueDate?: Date
}
