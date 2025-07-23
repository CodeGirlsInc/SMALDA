import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsUUID, IsObject, Min, Max } from "class-validator"
import { DatasetStatus, RiskLevel } from "../entities/dataset-record.entity"

export class CreateDatasetRecordDto {
  @IsString()
  inputData: string

  @IsOptional()
  @IsObject()
  features?: Record<string, any>

  @IsOptional()
  @IsEnum(RiskLevel)
  predictedRiskLevel?: RiskLevel

  @IsOptional()
  @IsEnum(RiskLevel)
  actualRiskLevel?: RiskLevel

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceScore?: number

  @IsOptional()
  @IsEnum(DatasetStatus)
  status?: DatasetStatus

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsUUID()
  sourceTransactionId?: string

  @IsOptional()
  @IsUUID()
  modelVersion?: string

  @IsOptional()
  @IsBoolean()
  isTrainingData?: boolean

  @IsOptional()
  @IsBoolean()
  isValidationData?: boolean

  @IsOptional()
  @IsBoolean()
  isTestData?: boolean
}
