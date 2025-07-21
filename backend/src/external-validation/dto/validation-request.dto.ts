import { IsEnum, IsOptional, IsString, IsObject, IsUUID, IsNumber, Min, Max } from "class-validator"
import { ValidationType } from "../entities/validation-request.entity"

export class CreateValidationRequestDto {
  @IsUUID()
  documentId: string

  @IsEnum(ValidationType)
  validationType: ValidationType

  @IsObject()
  requestPayload: Record<string, any>

  @IsOptional()
  @IsString()
  requestedBy?: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}

export class QueryValidationRequestDto {
  @IsOptional()
  @IsUUID()
  documentId?: string

  @IsOptional()
  @IsEnum(ValidationType)
  validationType?: ValidationType

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsString()
  result?: string

  @IsOptional()
  @IsString()
  requestedBy?: string

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0
}

export class RetryValidationDto {
  @IsOptional()
  @IsObject()
  updatedPayload?: Record<string, any>

  @IsOptional()
  @IsString()
  reason?: string
}
