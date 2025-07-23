import { Injectable, BadRequestException, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { GeoTag } from "./entities/geo-tag.entity"
import { LocationAccuracy } from "./entities/geo-tag.entity"
import type { CreateGeoTagDto } from "./dto/create-geo-tag.dto"
import type { DocumentsService } from "../documents/documents.service"
import type { RegexCoordinateExtractor } from "./extractors/regex-coordinate.extractor"
import type { AiCoordinateExtractor } from "./extractors/ai-coordinate.extractor"
import type { ExifCoordinateExtractor } from "./extractors/exif-coordinate.extractor"
import type { GeocodingService } from "./services/geocoding.service"
import type { CoordinateExtractor, ExtractedCoordinate } from "./interfaces/coordinate-extractor.interface"
import type { AuditLogService } from "../audit-log/audit-log.service"
import { AuditAction } from "../audit-log/entities/audit-log.entity"

@Injectable()
export class GeoTaggingService {
  private readonly logger = new Logger(GeoTaggingService.name)
  private readonly extractors: CoordinateExtractor[] = []

  constructor(
    private geoTagRepository: Repository<GeoTag>,
    private documentsService: DocumentsService,
    private regexExtractor: RegexCoordinateExtractor,
    private aiExtractor: AiCoordinateExtractor,
    private exifExtractor: ExifCoordinateExtractor,
    private geocodingService: GeocodingService,
    private auditLogService: AuditLogService,
  ) {
    // Register coordinate extractors
    this.extractors = [
      this.exifExtractor, // Try EXIF first for images
      this.regexExtractor, // Then regex patterns
      this.aiExtractor, // Finally AI extraction
    ]
  }

  async extractAndStoreCoordinates(
    documentId: string,
    extractedBy: string,
    extractedByEmail: string,
    options?: {
      forceReextraction?: boolean
      useAI?: boolean
      geocodeAddresses?: boolean
    }
  ): Promise<GeoTag[]> {
    try {
      // Check if coordinates already exist
      if (!options?.forceReextraction) {
        const existingTags = await this.findByDocumentId(documentId)
        if (existingTags.length > 0) {
          this.logger.log(`Document ${documentId} already has ${existingTags.length} geo-tags`)
          return existingTags
        }
      }

      // Get document details
      const document = await this.documentsService.findOne(documentId)
      
      // Extract text content from document
      const textContent = await this.extractTextFromDocument(document.filePath, document.mimeType)
      
      // Extract coordinates using available extractors
      const allExtractedCoords: ExtractedCoordinate[] = []
      
      for (const extractor of this.extractors) {
        if (extractor.canHandle(textContent, document.mimeType)) {
          // Skip AI extractor if not requested
          if (extractor.getExtractorName() === "AiCoordinateExtractor" && !options?.useAI) {
            continue
          }
          
          try {
            const coords = await extractor.extractCoordinates(textContent, document.originalName)
            allExtractedCoords.push(...coords)
            this.logger.log(`${extractor.getExtractorName()} found ${coords.length} coordinates`)
          } catch (error) {
            this.logger.warn(`${extractor.getExtractorName()} failed: ${error.message}`)
          }
        }
      }

      // For image files, also try extracting from file path (EXIF)
      if (document.mimeType.startsWith("image/")) {
        try {
          const exifCoords = await this.exifExtractor.extractCoordinates(document.filePath, document.originalName)
          allExtractedCoords.push(...exifCoords)
        } catch (error) {
          this.logger.warn(`EXIF extraction failed: ${error.message}`)
        }
      }

      // Remove duplicates and filter valid coordinates
      const uniqueCoords = this.deduplicateCoordinates(allExtractedCoords)
      
      // Geocode addresses if requested
      if (options?.geocodeAddresses) {
        const geocodedCoords = await this.geocodeExtractedAddresses(textContent)
        uniqueCoords.push(...geocodedCoords)
      }

      // Save coordinates to database
      const savedTags: GeoTag[] = []
      
      for (const coord of uniqueCoords) {
        try {
          // Enhance with reverse geocoding if no address info
          if (!coord.metadata?.address && coord.accuracy !== LocationAccuracy.UNKNOWN) {
            const reverseGeoResult = await this.geocodingService.reverseGeocode(coord.latitude, coord.longitude)
            if (reverseGeoResult) {
              coord.metadata = {
                ...coord.metadata,
                reverseGeocodedAddress: reverseGeoResult.address,
                reverseGeocodedCity: reverseGeoResult.city,
                reverseGeocodedRegion: reverseGeoResult.region,
                reverseGeocodedCountry: reverseGeoResult.country,
              }
            }
          }

          const geoTag = this.geoTagRepository.create({
            documentId,
            latitude: coord.latitude,
            longitude: coord.longitude,
            altitude: coord.altitude,
            source: coord.source,
            originalFormat: coord.originalFormat,
            accuracy: coord.accuracy,
            accuracyRadius: coord.accuracyRadius,
            extractedText: coord.extractedText,
            metadata: coord.metadata,
            extractedBy,
            extractedByEmail,
          })

          const savedTag = await this.geoTagRepository.save(geoTag)
          savedTags.push(savedTag)

          // Log the extraction
          await this.auditLogService.createAuditLog({
            userId: extractedBy,
            userEmail: extractedByEmail,
            action: AuditAction.CREATE,
            description: `Extracted geo-coordinates from document: ${coord.latitude}, ${coord.longitude}`,
            resourceType: "geo_tag",
            resourceId: savedTag.id,
            metadata: {
              documentId,
              source: coord.source,
              accuracy: coord.accuracy,
              confidence: coord.confidence,
            },
          })

        } catch (error) {
          this.logger.error(`Error saving geo-tag: ${error.message}`)
        }
      }

      this.logger.log(`Successfully extracted and stored ${savedTags.length} geo-tags for document ${documentId}`)
      return savedTags

    } catch (error) {
      this.logger.error(`Error extracting coordinates from document ${documentId}: ${error.message}`)
      throw new BadRequestException(`Failed to extract coordinates: ${error.message}`)
    }
  }

  async createGeoTag(createGeoTagDto: CreateGeoTagDto): Promise<GeoTag> {
    // Verify document exists
    await this.documentsService.findOne(createGeoTagDto.documentId)

    // Validate coordinates
    if (!this.isValidCoordinate(createGeoTagDto.latitude, createGeoTagDto.longitude)) {
      throw new BadRequestException("Invalid coordinates provided")
    }

    // Enhance with reverse geocoding if no address provided
    if (!createGeoTagDto.address) {
      const reverseGeoResult = await this.geocodingService.reverseGeocode(
        createGeoTagDto.latitude,
        createGeoTagDto.longitude
      )
      if (reverseGeoResult) {
        createGeoTagDto.address = reverseGeoResult.address
        createGeoTagDto.city = reverseGeoResult.city
        createGeoTagDto.region = reverseGeoResult.region
        createGeoTagDto.country = reverseGeoResult.country
      }
    }

    const geoTag = this.geoTagRepository.create(createGeoTagDto)
    const savedTag = await this.geoTagRepository.save(geoTag)

    // Log the creation
    await this.auditLogService.createAuditLog({
      userId: createGeoTagDto.extract
