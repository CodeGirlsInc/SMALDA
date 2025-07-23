import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"

export enum CoordinateSource {
  EXIF_DATA = "EXIF_DATA",
  DOCUMENT_CONTENT = "DOCUMENT_CONTENT",
  MANUAL_INPUT = "MANUAL_INPUT",
  AI_EXTRACTION = "AI_EXTRACTION",
  REGEX_EXTRACTION = "REGEX_EXTRACTION",
  GPS_METADATA = "GPS_METADATA",
}

export enum CoordinateFormat {
  DECIMAL_DEGREES = "DECIMAL_DEGREES", // 40.7128, -74.0060
  DEGREES_MINUTES_SECONDS = "DEGREES_MINUTES_SECONDS", // 40°42'46"N, 74°00'22"W
  DEGREES_DECIMAL_MINUTES = "DEGREES_DECIMAL_MINUTES", // 40°42.767'N, 74°00.367'W
  UTM = "UTM", // Universal Transverse Mercator
  MGRS = "MGRS", // Military Grid Reference System
}

export enum LocationAccuracy {
  EXACT = "EXACT", // GPS coordinates
  APPROXIMATE = "APPROXIMATE", // City/region level
  ESTIMATED = "ESTIMATED", // AI/text extraction
  UNKNOWN = "UNKNOWN", // Cannot determine accuracy
}

@Entity("geo_tags")
@Index(["documentId"])
@Index(["latitude", "longitude"])
@Index(["extractedBy"])
@Index(["source"])
export class GeoTag {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ name: "document_id" })
  @Index()
  documentId: string

  @Column("decimal", { precision: 10, scale: 8 })
  latitude: number

  @Column("decimal", { precision: 11, scale: 8 })
  longitude: number

  @Column({ nullable: true })
  altitude?: number

  @Column({
    type: "enum",
    enum: CoordinateSource,
    default: CoordinateSource.DOCUMENT_CONTENT,
  })
  source: CoordinateSource

  @Column({
    type: "enum",
    enum: CoordinateFormat,
    default: CoordinateFormat.DECIMAL_DEGREES,
  })
  originalFormat: CoordinateFormat

  @Column({
    type: "enum",
    enum: LocationAccuracy,
    default: LocationAccuracy.ESTIMATED,
  })
  accuracy: LocationAccuracy

  @Column({ nullable: true })
  accuracyRadius?: number // in meters

  @Column({ nullable: true })
  address?: string

  @Column({ nullable: true })
  city?: string

  @Column({ nullable: true })
  region?: string

  @Column({ nullable: true })
  country?: string

  @Column({ nullable: true })
  postalCode?: string

  @Column("text", { nullable: true })
  extractedText?: string // Original text that contained coordinates

  @Column("jsonb", { nullable: true })
  metadata?: {
    confidence?: number
    extractionMethod?: string
    originalCoordinates?: string
    timezone?: string
    elevation?: number
    magneticDeclination?: number
    [key: string]: any
  }

  @Column({ name: "extracted_by" })
  extractedBy: string

  @Column({ name: "extracted_by_email" })
  extractedByEmail: string

  @Column({ name: "verified_by", nullable: true })
  verifiedBy?: string

  @Column({ name: "verified_at", nullable: true })
  verifiedAt?: Date

  @Column({ default: false })
  isVerified: boolean

  @Column({ default: true })
  isActive: boolean

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date
}
