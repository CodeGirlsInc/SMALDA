import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsEmail,
  IsDateString,
  IsBoolean,
  IsObject,
  ValidateIf,
  MaxLength,
} from "class-validator"
import { OwnerType } from "../enums/owner-type.enum"
import { CorporateType } from "../enums/corporate-type.enum"
import { ApiProperty } from "@nestjs/swagger"

export class CreatePropertyOwnerDto {
  @ApiProperty({ enum: OwnerType, description: "Type of owner (individual or corporate)" })
  @IsNotEmpty()
  @IsEnum(OwnerType)
  ownerType: OwnerType

  // Individual-specific fields (required when ownerType is INDIVIDUAL)
  @ApiProperty({ description: "First name (required for individuals)", required: false })
  @ValidateIf((o) => o.ownerType === OwnerType.INDIVIDUAL)
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  firstName?: string

  @ApiProperty({ description: "Last name (required for individuals)", required: false })
  @ValidateIf((o) => o.ownerType === OwnerType.INDIVIDUAL)
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  lastName?: string

  @ApiProperty({ description: "Date of birth (for individuals)", required: false, format: "date" })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string

  @ApiProperty({ description: "National ID or passport number (for individuals)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nationalId?: string

  // Corporate-specific fields (required when ownerType is CORPORATE)
  @ApiProperty({ description: "Company/organization name (required for corporates)", required: false })
  @ValidateIf((o) => o.ownerType === OwnerType.CORPORATE)
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  companyName?: string

  @ApiProperty({ description: "Registration number (for corporates)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string

  @ApiProperty({ enum: CorporateType, description: "Type of corporate entity", required: false })
  @IsOptional()
  @IsEnum(CorporateType)
  corporateType?: CorporateType

  @ApiProperty({ description: "Date of incorporation/establishment (for corporates)", required: false, format: "date" })
  @IsOptional()
  @IsDateString()
  incorporationDate?: string

  @ApiProperty({ description: "Tax identification number", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string

  // Common contact information
  @ApiProperty({ description: "Primary email address" })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email: string

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
  @ApiProperty({ description: "Street address" })
  @IsNotEmpty()
  @IsString()
  address: string

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

  @ApiProperty({ description: "Country", default: "Nigeria" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string

  // Additional information
  @ApiProperty({ description: "Additional notes or comments about the owner", required: false })
  @IsOptional()
  @IsString()
  notes?: string

  @ApiProperty({ description: "Whether the owner is currently active", required: false, default: true })
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
