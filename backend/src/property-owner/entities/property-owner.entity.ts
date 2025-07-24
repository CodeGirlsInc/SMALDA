import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from "typeorm"
import { OwnerType } from "../enums/owner-type.enum"
import { CorporateType } from "../enums/corporate-type.enum"
import { Document } from "../../document-history/entities/document.entity"
import { ApiProperty } from "@nestjs/swagger"

@Entity("property_owners")
export class PropertyOwner {
  @ApiProperty({ description: "Unique identifier for the property owner" })
  @PrimaryGeneratedColumn("uuid")
  id: string

  @ApiProperty({ enum: OwnerType, description: "Type of owner (individual or corporate)" })
  @Column({ type: "enum", enum: OwnerType })
  ownerType: OwnerType

  // Individual-specific fields
  @ApiProperty({ description: "First name (for individuals)", nullable: true })
  @Column({ type: "varchar", length: 100, nullable: true })
  firstName?: string

  @ApiProperty({ description: "Last name (for individuals)", nullable: true })
  @Column({ type: "varchar", length: 100, nullable: true })
  lastName?: string

  @ApiProperty({ description: "Date of birth (for individuals)", nullable: true })
  @Column({ type: "date", nullable: true })
  dateOfBirth?: Date

  @ApiProperty({ description: "National ID or passport number (for individuals)", nullable: true })
  @Column({ type: "varchar", length: 50, nullable: true })
  nationalId?: string

  // Corporate-specific fields
  @ApiProperty({ description: "Company/organization name (for corporates)", nullable: true })
  @Column({ type: "varchar", length: 255, nullable: true })
  companyName?: string

  @ApiProperty({ description: "Registration number (for corporates)", nullable: true })
  @Column({ type: "varchar", length: 100, nullable: true })
  registrationNumber?: string

  @ApiProperty({ enum: CorporateType, description: "Type of corporate entity", nullable: true })
  @Column({ type: "enum", enum: CorporateType, nullable: true })
  corporateType?: CorporateType

  @ApiProperty({ description: "Date of incorporation/establishment (for corporates)", nullable: true })
  @Column({ type: "date", nullable: true })
  incorporationDate?: Date

  @ApiProperty({ description: "Tax identification number", nullable: true })
  @Column({ type: "varchar", length: 50, nullable: true })
  taxId?: string

  // Common contact information
  @ApiProperty({ description: "Primary email address" })
  @Column({ type: "varchar", length: 255 })
  email: string

  @ApiProperty({ description: "Primary phone number", nullable: true })
  @Column({ type: "varchar", length: 20, nullable: true })
  phoneNumber?: string

  @ApiProperty({ description: "Secondary phone number", nullable: true })
  @Column({ type: "varchar", length: 20, nullable: true })
  alternatePhoneNumber?: string

  // Address information
  @ApiProperty({ description: "Street address" })
  @Column({ type: "text" })
  address: string

  @ApiProperty({ description: "City", nullable: true })
  @Column({ type: "varchar", length: 100, nullable: true })
  city?: string

  @ApiProperty({ description: "State/Province", nullable: true })
  @Column({ type: "varchar", length: 100, nullable: true })
  state?: string

  @ApiProperty({ description: "Postal/ZIP code", nullable: true })
  @Column({ type: "varchar", length: 20, nullable: true })
  postalCode?: string

  @ApiProperty({ description: "Country" })
  @Column({ type: "varchar", length: 100, default: "Nigeria" })
  country: string

  // Additional information
  @ApiProperty({ description: "Additional notes or comments about the owner", nullable: true })
  @Column({ type: "text", nullable: true })
  notes?: string

  @ApiProperty({ description: "Whether the owner is currently active", default: true })
  @Column({ type: "boolean", default: true })
  isActive: boolean

  @ApiProperty({
    description: "Additional metadata (e.g., legal representative info, emergency contacts)",
    type: "object",
    additionalProperties: true,
    nullable: true,
  })
  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>

  @ApiProperty({ type: () => [Document], description: "Documents owned by this property owner" })
  @OneToMany(
    () => Document,
    (document) => document.owner,
  )
  documents: Document[]

  @ApiProperty({ description: "Timestamp when the property owner record was created" })
  @CreateDateColumn({ type: "timestamp with time zone", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date

  @ApiProperty({ description: "Timestamp when the property owner record was last updated" })
  @UpdateDateColumn({ type: "timestamp with time zone", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date

  @ApiProperty({ description: "Timestamp when the property owner record was soft-deleted", nullable: true })
  @DeleteDateColumn({ type: "timestamp with time zone", nullable: true })
  deletedAt?: Date
}
