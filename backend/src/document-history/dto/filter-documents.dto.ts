import { IsOptional, IsEnum, IsString, IsNumber, Min, Max, IsUUID } from "class-validator" // NEW: IsUUID
import { Type } from "class-transformer"
import { DocumentType } from "../enums/document-type.enum"
import { ApiProperty } from "@nestjs/swagger"

export class FilterDocumentsDto {
  @ApiProperty({ description: "Filter by document name (partial match)", required: false })
  @IsOptional()
  @IsString()
  name?: string

  @ApiProperty({ enum: DocumentType, description: "Filter by document type", required: false })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType

  @ApiProperty({ description: "Filter by document owner ID", required: false, format: "uuid" })
  @IsOptional()
  @IsString()
  ownerId?: string

  @ApiProperty({ description: "Filter by property owner ID", required: false, format: "uuid" }) // NEW
  @IsOptional()
  @IsUUID()
  propertyOwnerId?: string // NEW

  @ApiProperty({ description: "Filter by a specific tag name associated with the document", required: false })
  @IsOptional()
  @IsString()
  tag?: string

  @ApiProperty({ description: "Page number for pagination", required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number

  @ApiProperty({ description: "Number of items per page", required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number

  @ApiProperty({ description: "Field to sort by (e.g., createdAt, name)", required: false, default: "createdAt" })
  @IsOptional()
  @IsString()
  sortBy?: string

  @ApiProperty({ enum: ["ASC", "DESC"], description: "Sort order (ASC or DESC)", required: false, default: "DESC" })
  @IsOptional()
  @IsEnum(["ASC", "DESC"])
  sortOrder?: "ASC" | "DESC"
}
