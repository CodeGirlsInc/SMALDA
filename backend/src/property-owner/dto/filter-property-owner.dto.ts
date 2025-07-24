import { IsOptional, IsEnum, IsString, IsNumber, Min, Max, IsBoolean } from "class-validator"
import { Type, Transform } from "class-transformer"
import { OwnerType } from "../enums/owner-type.enum"
import { CorporateType } from "../enums/corporate-type.enum"
import { ApiProperty } from "@nestjs/swagger"

export class FilterPropertyOwnerDto {
  @ApiProperty({ enum: OwnerType, description: "Filter by owner type", required: false })
  @IsOptional()
  @IsEnum(OwnerType)
  ownerType?: OwnerType

  @ApiProperty({ description: "Search term for name (works for both individual and corporate names)", required: false })
  @IsOptional()
  @IsString()
  search?: string

  @ApiProperty({ description: "Filter by email address (partial match)", required: false })
  @IsOptional()
  @IsString()
  email?: string

  @ApiProperty({ description: "Filter by phone number (partial match)", required: false })
  @IsOptional()
  @IsString()
  phoneNumber?: string

  @ApiProperty({ description: "Filter by city", required: false })
  @IsOptional()
  @IsString()
  city?: string

  @ApiProperty({ description: "Filter by state/province", required: false })
  @IsOptional()
  @IsString()
  state?: string

  @ApiProperty({ description: "Filter by country", required: false })
  @IsOptional()
  @IsString()
  country?: string

  @ApiProperty({
    enum: CorporateType,
    description: "Filter by corporate type (only for corporate owners)",
    required: false,
  })
  @IsOptional()
  @IsEnum(CorporateType)
  corporateType?: CorporateType

  @ApiProperty({ description: "Filter by active status", required: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true") return true
    if (value === "false") return false
    return value
  })
  @IsBoolean()
  isActive?: boolean

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

  @ApiProperty({
    description: "Field to sort by (e.g., createdAt, firstName, companyName)",
    required: false,
    default: "createdAt",
  })
  @IsOptional()
  @IsString()
  sortBy?: string

  @ApiProperty({ enum: ["ASC", "DESC"], description: "Sort order (ASC or DESC)", required: false, default: "DESC" })
  @IsOptional()
  @IsEnum(["ASC", "DESC"])
  sortOrder?: "ASC" | "DESC"
}
