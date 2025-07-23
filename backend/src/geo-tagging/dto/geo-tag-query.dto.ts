import { IsOptional, IsString, IsNumber, IsEnum, IsBoolean, Min, Max } from "class-validator"
import { Transform } from "class-transformer"
import { CoordinateSource, LocationAccuracy } from "../entities/geo-tag.entity"

export class GeoTagQueryDto {
  @IsOptional()
  @IsString()
  documentId?: string

  @IsOptional()
  @IsString()
  extractedBy?: string

  @IsOptional()
  @IsEnum(CoordinateSource)
  source?: CoordinateSource

  @IsOptional()
  @IsEnum(LocationAccuracy)
  accuracy?: LocationAccuracy

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
  @IsBoolean()
  @Transform(({ value }) => value === "true")
  isVerified?: boolean

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === "true")
  isActive?: boolean

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => Number.parseInt(value))
  @Min(1)
  @Max(1000)
  limit?: number = 50

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => Number.parseInt(value))
  @Min(0)
  offset?: number = 0
}

export class GeoSearchDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  centerLatitude: number

  @IsNumber()
  @Min(-180)
  @Max(180)
  centerLongitude: number

  @IsNumber()
  @Min(0.001)
  @Max(1000)
  radiusKm: number

  @IsOptional()
  @IsString()
  documentId?: string

  @IsOptional()
  @IsEnum(CoordinateSource)
  source?: CoordinateSource

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => Number.parseInt(value))
  @Min(1)
  @Max(1000)
  limit?: number = 50
}

export class BoundingBoxSearchDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  northLatitude: number

  @IsNumber()
  @Min(-90)
  @Max(90)
  southLatitude: number

  @IsNumber()
  @Min(-180)
  @Max(180)
  eastLongitude: number

  @IsNumber()
  @Min(-180)
  @Max(180)
  westLongitude: number

  @IsOptional()
  @IsEnum(CoordinateSource)
  source?: CoordinateSource

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => Number.parseInt(value))
  @Min(1)
  @Max(1000)
  limit?: number = 50
}
