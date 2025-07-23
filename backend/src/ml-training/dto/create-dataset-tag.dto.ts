import { IsString, IsOptional, IsEnum, IsNumber, IsUUID, Min, Max } from "class-validator"
import { TagCategory } from "../entities/dataset-tag.entity"

export class CreateDatasetTagDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  value?: string

  @IsOptional()
  @IsEnum(TagCategory)
  category?: TagCategory

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  weight?: number

  @IsUUID()
  createdBy: string

  @IsUUID()
  datasetRecordId: string
}
