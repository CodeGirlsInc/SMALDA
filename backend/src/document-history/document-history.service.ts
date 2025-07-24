import { Injectable, BadRequestException } from "@nestjs/common"
import { type Repository, IsNull } from "typeorm"
import { Document } from "./entities/document.entity"
import { DocumentVersion } from "./entities/document-version.entity"
import type { CreateDocumentDto } from "./dto/create-document.dto"
import type { UpdateDocumentDto } from "./dto/update-document.dto"
import type { FilterDocumentVersionsDto } from "./dto/filter-document-versions.dto"
import type { FilterDocumentsDto } from "./dto/filter-documents.dto"
import type { OcrExtractionService } from "../ocr-extraction/ocr-extraction.service"
import type { TaggingService } from "../tagging/tagging.service"
import type { PropertyOwnerService } from "../property-owner/property-owner.service" // NEW

@Injectable()
export class DocumentHistoryService {
  constructor(
    private documentRepository: Repository<Document>,
    private documentVersionRepository: Repository<DocumentVersion>,
    private ocrExtractionService: OcrExtractionService,
    private taggingService: TaggingService,
    private propertyOwnerService: PropertyOwnerService, // NEW
  ) {}

  /**
   * Creates a new document and its initial version.
   * Performs OCR if extractedText is not provided in the DTO.
   * Associates tags and property owner with the document.
   * @param createDocumentDto DTO containing document and initial version data.
   * @returns The created Document entity with its current version.
   */
  async createDocument(createDocumentDto: CreateDocumentDto): Promise<Document> {
    const {
      name,
      description,
      documentType,
      ownerId,
      propertyOwnerId, // NEW
      tagNames,
      uploadedBy,
      documentUrl,
      riskReport,
      riskSummary,
      riskStatus,
      uploadNotes,
      extractedText,
    } = createDocumentDto

    // Validate property owner exists if provided
    if (propertyOwnerId) {
      const propertyOwner = await this.propertyOwnerService.findOne(propertyOwnerId)
      if (!propertyOwner) {
        throw new BadRequestException(`Property owner with ID "${propertyOwnerId}" not found.`)
      }
    }

    // Perform OCR if extractedText is not provided
    const finalExtractedText = extractedText || (await this.ocrExtractionService.extractText(documentUrl))

    // Find or create tags based on provided tag names
    const tags = tagNames ? await this.taggingService.findOrCreateTags(tagNames) : []

    // Create the main document entry
    const document = this.documentRepository.create({
      name,
      description,
      documentType,
      ownerId,
      propertyOwnerId, // NEW
      tags,
    })

    // Create the first version
    const initialVersion = this.documentVersionRepository.create({
      document: document,
      versionNumber: 1,
      uploadedBy,
      documentUrl,
      riskReport,
      riskSummary,
      riskStatus,
      uploadNotes,
      extractedText: finalExtractedText,
    })

    // Use a transaction to ensure atomicity
    return this.documentRepository.manager.transaction(async (transactionalEntityManager) => {
      const savedDocument = await transactionalEntityManager.save(document)
      initialVersion.document = savedDocument
      const savedVersion = await transactionalEntityManager.save(initialVersion)

      // Update the document to point to its current version
      savedDocument.currentVersion = savedVersion
      savedDocument.currentVersionId = savedVersion.id
      return transactionalEntityManager.save(savedDocument)
    })
  }

  /**
   * Retrieves all current documents with optional filtering and pagination.
   * Eagerly loads the current version, tags, and property owner for each document.
   * @param filterDto Filter and pagination options.
   * @returns An object containing current documents and total count.
   */
  async findAllDocuments(filterDto: FilterDocumentsDto): Promise<{ data: Document[]; total: number }> {
    const {
      name,
      documentType,
      ownerId,
      propertyOwnerId, // NEW
      tag,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = filterDto

    const queryBuilder = this.documentRepository.createQueryBuilder("document")

    queryBuilder.leftJoinAndSelect("document.currentVersion", "currentVersion")
    queryBuilder.leftJoinAndSelect("document.tags", "tags")
    queryBuilder.leftJoinAndSelect("document.owner", "owner") // NEW: Eager load property owner
    queryBuilder.where("document.deletedAt IS NULL")

    if (name) {
      queryBuilder.andWhere("document.name ILIKE :name", { name: `%${name}%` })
    }
    if (documentType) {
      queryBuilder.andWhere("document.documentType = :documentType", { documentType })
    }
    if (ownerId) {
      queryBuilder.andWhere("document.ownerId = :ownerId", { ownerId })
    }
    if (propertyOwnerId) {
      // NEW: Filter by property owner
      queryBuilder.andWhere("document.propertyOwnerId = :propertyOwnerId", { propertyOwnerId })
    }
    if (tag) {
      queryBuilder.andWhere("tags.name ILIKE :tag", { tag: `%${tag}%` })
    }

    queryBuilder.orderBy(`document.${sortBy}`, sortOrder)
    queryBuilder.skip((page - 1) * limit).take(limit)

    const [data, total] = await queryBuilder.getManyAndCount()
    return { data, total }
  }

  /**
   * Retrieves a single document by ID, including its current version, tags, and property owner.
   * @param id The UUID of the document.
   * @returns The Document entity or undefined if not found.
   */
  async findOneDocument(id: string): Promise<Document | undefined> {
    return this.documentRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ["currentVersion", "tags", "owner"], // NEW: Include property owner
    })
  }

  /**
   * Updates a document's metadata and creates a new version for document-specific data.
   * Performs OCR if extractedText is not provided in the DTO.
   * Updates associated tags and property owner.
   * @param id The UUID of the document to update.
   * @param updateDocumentDto DTO containing updated document and new version data.
   * @returns The updated Document entity with its new current version.
   */
  async updateDocument(id: string, updateDocumentDto: UpdateDocumentDto): Promise<Document | undefined> {
    const document = await this.findOneDocument(id)
    if (!document) {
      return undefined
    }

    // Validate property owner exists if provided
    if (updateDocumentDto.propertyOwnerId !== undefined) {
      if (updateDocumentDto.propertyOwnerId) {
        const propertyOwner = await this.propertyOwnerService.findOne(updateDocumentDto.propertyOwnerId)
        if (!propertyOwner) {
          throw new BadRequestException(`Property owner with ID "${updateDocumentDto.propertyOwnerId}" not found.`)
        }
      }
    }

    // Update document metadata fields
    document.name = updateDocumentDto.name ?? document.name
    document.description = updateDocumentDto.description ?? document.description
    document.documentType = updateDocumentDto.documentType ?? document.documentType
    document.ownerId = updateDocumentDto.ownerId ?? document.ownerId
    document.propertyOwnerId = updateDocumentDto.propertyOwnerId ?? document.propertyOwnerId // NEW

    // Update tags if provided
    if (updateDocumentDto.tagNames !== undefined) {
      document.tags = await this.taggingService.findOrCreateTags(updateDocumentDto.tagNames)
    }

    // Perform OCR if extractedText is not provided in the update DTO
    const finalExtractedText =
      updateDocumentDto.extractedText || (await this.ocrExtractionService.extractText(updateDocumentDto.documentUrl))

    // Create a new version
    const newVersion = this.documentVersionRepository.create({
      document: document,
      versionNumber: (document.currentVersion?.versionNumber || 0) + 1,
      uploadedBy: updateDocumentDto.uploadedBy,
      documentUrl: updateDocumentDto.documentUrl,
      riskReport: updateDocumentDto.riskReport,
      riskSummary: updateDocumentDto.riskSummary,
      riskStatus: updateDocumentDto.riskStatus,
      uploadNotes: updateDocumentDto.uploadNotes,
      extractedText: finalExtractedText,
    })

    // Ensure required fields for new version are present
    if (!newVersion.uploadedBy || !newVersion.documentUrl || !newVersion.riskReport || !newVersion.riskStatus) {
      throw new BadRequestException(
        "Missing required fields for new document version: uploadedBy, documentUrl, riskReport, riskStatus.",
      )
    }

    return this.documentRepository.manager.transaction(async (transactionalEntityManager) => {
      const savedNewVersion = await transactionalEntityManager.save(newVersion)

      // Update the document to point to the new current version
      document.currentVersion = savedNewVersion
      document.currentVersionId = savedNewVersion.id
      return transactionalEntityManager.save(document)
    })
  }

  /**
   * Soft deletes a document and all its associated versions.
   * @param id The UUID of the document to delete.
   * @returns True if deleted, false if not found.
   */
  async removeDocument(id: string): Promise<boolean> {
    const document = await this.documentRepository.findOne({ where: { id, deletedAt: IsNull() } })
    if (!document) {
      return false
    }

    return this.documentRepository.manager.transaction(async (transactionalEntityManager) => {
      // Soft delete all versions associated with this document
      await transactionalEntityManager.softDelete(DocumentVersion, { document: { id: document.id } })
      // Soft delete the document itself
      const result = await transactionalEntityManager.softDelete(Document, id)
      return result.affected > 0
    })
  }

  /**
   * Retrieves all versions for a specific document with optional filtering and pagination.
   * @param documentId The UUID of the document.
   * @param filterDto Filter and pagination options.
   * @returns An object containing document versions and total count.
   */
  async findDocumentVersions(
    documentId: string,
    filterDto: FilterDocumentVersionsDto,
  ): Promise<{ data: DocumentVersion[]; total: number }> {
    const {
      versionNumber,
      uploadedBy,
      riskStatus,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = filterDto

    const queryBuilder = this.documentVersionRepository.createQueryBuilder("version")

    queryBuilder.where("version.documentId = :documentId", { documentId })

    if (versionNumber) {
      queryBuilder.andWhere("version.versionNumber = :versionNumber", { versionNumber })
    }
    if (uploadedBy) {
      queryBuilder.andWhere("version.uploadedBy = :uploadedBy", { uploadedBy })
    }
    if (riskStatus) {
      queryBuilder.andWhere("version.riskStatus = :riskStatus", { riskStatus })
    }
    if (startDate) {
      queryBuilder.andWhere("version.createdAt >= :startDate", { startDate: new Date(startDate) })
    }
    if (endDate) {
      queryBuilder.andWhere("version.createdAt <= :endDate", { endDate: new Date(endDate) })
    }

    queryBuilder.orderBy(`version.${sortBy}`, sortOrder)
    queryBuilder.skip((page - 1) * limit).take(limit)

    const [data, total] = await queryBuilder.getManyAndCount()
    return { data, total }
  }

  /**
   * Retrieves a specific version of a document by its document ID and version number.
   * @param documentId The UUID of the document.
   * @param versionNumber The specific version number.
   * @returns The DocumentVersion entity or undefined if not found.
   */
  async findSpecificDocumentVersion(documentId: string, versionNumber: number): Promise<DocumentVersion | undefined> {
    return this.documentVersionRepository.findOne({
      where: {
        document: { id: documentId },
        versionNumber: versionNumber,
      },
    })
  }

  /**
   * Helper to check if a document exists and is not soft-deleted.
   * @param id The UUID of the document.
   * @returns True if document exists, false otherwise.
   */
  async checkDocumentExists(id: string): Promise<boolean> {
    const count = await this.documentRepository.count({ where: { id, deletedAt: IsNull() } })
    return count > 0
  }
}
