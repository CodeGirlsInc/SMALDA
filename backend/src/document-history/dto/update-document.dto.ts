import { PartialType } from "@nestjs/swagger"
import { CreateDocumentDto } from "./create-document.dto"
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID, IsUrl, IsObject, IsArray } from "class-validator"
import { DocumentType } from "../enums/document-type.enum"
import { RiskStatus } from "../enums/risk-status.enum"
import { ApiProperty } from "@nestjs/swagger"

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {
  @ApiProperty({ description: "Updated name of the document", required: false })
  @IsOptional()
  @IsString()
  name?: string

  @ApiProperty({ description: "Updated description of the document", required: false })
  @IsOptional()
  @IsString()
  description?: string

  @ApiProperty({ enum: DocumentType, description: "Updated type of the document", required: false })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType

  @ApiProperty({
    description: "Updated ID of the user or entity that owns this document",
    required: false,
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string

  @ApiProperty({
    description: "Updated ID of the property owner associated with this document",
    required: false,
    format: "uuid",
  }) // NEW
  @IsOptional()
  @IsUUID()
  propertyOwnerId?: string // NEW

  @ApiProperty({ description: "Array of tag names to associate with the document", type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagNames?: string[]

  // Fields for the NEW DocumentVersion (these are required for a new version)
  @ApiProperty({ description: "ID of the user who uploaded this new version", format: "uuid" })
  @IsNotEmpty()
  @IsUUID()
  uploadedBy: string

  @ApiProperty({ description: "URL or path to the actual document file for this new version" })
  @IsNotEmpty()
  @IsString()
  @IsUrl({ require_tld: false })
  documentUrl: string

  @ApiProperty({
    description: "Structured JSON data of the risk report for this new version",
    type: "object",
    additionalProperties: true,
  })
  @IsNotEmpty()
  @IsObject()
  riskReport: Record<string, any>

  @ApiProperty({ description: "A brief summary of the risks identified in this new version", required: false })
  @IsOptional()
  @IsString()
  riskSummary?: string

  @ApiProperty({ enum: RiskStatus, description: "Overall risk status for this new document version" })
  @IsNotEmpty()
  @IsEnum(RiskStatus)
  riskStatus: RiskStatus

  @ApiProperty({ description: "Notes about this new version upload or edit", required: false })
  @IsOptional()
  @IsString()
  uploadNotes?: string

  @ApiProperty({
    description:
      "Optional pre-extracted text content from OCR for the new version. If not provided, OCR will be performed.",
    required: false,
  })
  @IsOptional()
  @IsString()
  extractedText?: string
}
