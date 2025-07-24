import { IsOptional, IsString, IsNumber, Min, Max, IsEnum } from "class-validator"
import { Type } from "class-transformer"
import { ApiProperty } from "@nestjs/swagger"

export class FilterTagDto {
  @ApiProperty({ description: "Search term for tag name (partial match)", required: false })
  @IsOptional()
  @IsString()
  search?: string

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

  @ApiProperty({ description: "Field to sort by (e.g., name, createdAt)", required: false, default: "name" })
  @IsOptional()
  @IsString()
  sortBy?: string

  @ApiProperty({ enum: ["ASC", "DESC"], description: "Sort order (ASC or DESC)", required: false, default: "ASC" })
  @IsOptional()
  @IsEnum(["ASC", "DESC"])
  sortOrder?: "ASC" | "DESC"
}
