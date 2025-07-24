import { PartialType } from "@nestjs/swagger"
import { CreatePropertyOwnerDto } from "./create-property-owner.dto"
import { IsString, IsOptional, IsEnum, IsEmail, IsDateString, IsBoolean, IsObject, MaxLength } from "class-validator"
import { OwnerType } from "../enums/owner-type.enum"
import { CorporateType } from "../enums/corporate-type.enum"
import { ApiProperty } from "@nestjs/swagger"

export class UpdatePropertyOwnerDto extends PartialType(CreatePropertyOwnerDto) {
  @ApiProperty({ enum: OwnerType, description: "Type of owner (individual or corporate)", required: false })
  @IsOptional()
  @IsEnum(OwnerType)
  ownerType?: OwnerType

  // Individual-specific fields
  @ApiProperty({ description: "First name", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string

  @ApiProperty({ description: "Last name", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string

  @ApiProperty({ description: "Date of birth", required: false, format: "date" })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string

  @ApiProperty({ description: "National ID or passport number", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nationalId?: string

  // Corporate-specific fields
  @ApiProperty({ description: "Company/organization name", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string

  @ApiProperty({ description: "Registration number", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string

  @ApiProperty({ enum: CorporateType, description: "Type of corporate entity", required: false })
  @IsOptional()
  @IsEnum(CorporateType)
  corporateType?: CorporateType

  @ApiProperty({ description: "Date of incorporation/establishment", required: false, format: "date" })
  @IsOptional()
  @IsDateString()
  incorporationDate?: string

  @ApiProperty({ description: "Tax identification number", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string

  // Common contact information
  @ApiProperty({ description: "Primary email address", required: false })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string

  @ApiProperty({ description: "Primary phone number", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string

  @ApiProperty({ description: "Secondary phone number", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  alternatePhoneNumber?: string

  // Address information
  @ApiProperty({ description: "Street address", required: false })
  @IsOptional()
  @IsString()
  address?: string

  @ApiProperty({ description: "City", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string

  @ApiProperty({ description: "State/Province", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string

  @ApiProperty({ description: "Postal/ZIP code", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string

  @ApiProperty({ description: "Country", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string

  // Additional information
  @ApiProperty({ description: "Additional notes or comments about the owner", required: false })
  @IsOptional()
  @IsString()
  notes?: string

  @ApiProperty({ description: "Whether the owner is currently active", required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @ApiProperty({
    description: "Additional metadata",
    type: "object",
    additionalProperties: true,
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}
