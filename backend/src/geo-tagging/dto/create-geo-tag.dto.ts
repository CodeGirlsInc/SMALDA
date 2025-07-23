import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, Min, Max } from "class-validator"
import { CoordinateSource, CoordinateFormat, LocationAccuracy } from "../entities/geo-tag.entity"

export class CreateGeoTagDto {
  @IsString()
  documentId: string

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number

  @IsOptional()
  @IsNumber()
  altitude?: number

  @IsEnum(CoordinateSource)
  source: CoordinateSource

  @IsEnum(CoordinateFormat)
  originalFormat: CoordinateFormat

  @IsEnum(LocationAccuracy)
  accuracy: LocationAccuracy

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracyRadius?: number

  @IsOptional()
  @IsString()
  address?: string

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  region?: string

  @IsOptional()
  @IsString()
  country?: string

  @IsOptional()
  @IsString()
  postalCode?: string

  @IsOptional()
  @IsString()
  extractedText?: string

  @IsOptional()
  metadata?: any

  @IsString()
  extractedBy: string

  @IsString()
  extractedByEmail: string

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean
}
