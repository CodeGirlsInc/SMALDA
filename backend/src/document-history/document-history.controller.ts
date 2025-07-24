import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common"
import type { DocumentHistoryService } from "./document-history.service"
import type { CreateDocumentDto } from "./dto/create-document.dto"
import type { UpdateDocumentDto } from "./dto/update-document.dto"
import type { FilterDocumentVersionsDto } from "./dto/filter-document-versions.dto"
import type { FilterDocumentsDto } from "./dto/filter-documents.dto"
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from "@nestjs/swagger"
import { Document } from "./entities/document.entity"
import { DocumentVersion } from "./entities/document-version.entity"
import { DocumentType } from "./enums/document-type.enum"

@ApiTags("Document History")
@Controller("documents")
export class DocumentHistoryController {
  constructor(private readonly documentHistoryService: DocumentHistoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a new document and its initial version (OCR performed automatically if text not provided)",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Document and its first version successfully created.",
    type: Document,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "Invalid input data." })
  async create(createDocumentDto: CreateDocumentDto) {
    return this.documentHistoryService.createDocument(createDocumentDto)
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve all current documents with optional filtering and pagination' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of current documents.', type: [Document] })
  @ApiQuery({ name: 'name', required: false, type: String, description: 'Filter by document name (partial match)' })
  @ApiQuery({ name: 'documentType', required: false, enum: DocumentType, description: 'Filter by document type' })
  @ApiQuery({ name: 'ownerId', required: false, type: String, description: 'Filter by document owner ID' })
  @ApiQuery({ name: 'propertyOwnerId', required: false, type: String, description: 'Filter by property owner ID' }) // NEW
  @ApiQuery({ name: 'tag', required: false, type: String, description: 'Filter by a specific tag name associated with the document' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Field to sort by (e.g., createdAt, name)' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Sort order (ASC or DESC)' })
  async findAllCurrent(@Query() filterDto: FilterDocumentsDto) {
    return this.documentHistoryService.findAllDocuments(filterDto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve a single document by ID with its current version, tags, and property owner' }) // Updated summary
  @ApiResponse({ status: HttpStatus.OK, description: 'Document found with its current version.', type: Document })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Document not found.' })
  @ApiParam({ name: 'id', type: String, description: 'UUID of the document' })
  async findOne(@Param('id') id: string) {
    const document = await this.documentHistoryService.findOneDocument(id);
    if (!document) {
      throw new NotFoundException(`Document with ID "${id}" not found.`);
    }
    return document;
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Update a document and create a new version (OCR performed automatically if text not provided)",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Document successfully updated and new version created.",
    type: Document,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: "Document not found." })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "Invalid input data." })
  @ApiParam({ name: "id", type: String, description: "UUID of the document to update" })
  async update(@Param('id') id: string, updateDocumentDto: UpdateDocumentDto) {
    const updatedDocument = await this.documentHistoryService.updateDocument(id, updateDocumentDto)
    if (!updatedDocument) {
      throw new NotFoundException(`Document with ID "${id}" not found.`)
    }
    return updatedDocument
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a document and its versions' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Document and its versions successfully soft-deleted.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Document not found.' })
  @ApiParam({ name: 'id', type: String, description: 'UUID of the document to delete' })
  async remove(@Param('id') id: string) {
    const result = await this.documentHistoryService.removeDocument(id);
    if (!result) {
      throw new NotFoundException(`Document with ID "${id}" not found.`);
    }
  }

  // --- Document Version History Endpoints ---

  @Get(":documentId/versions")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Retrieve all versions for a specific document" })
  @ApiResponse({ status: HttpStatus.OK, description: "List of document versions.", type: [DocumentVersion] })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: "Document not found." })
  @ApiParam({ name: "documentId", type: String, description: "UUID of the document" })
  @ApiQuery({ name: "versionNumber", required: false, type: Number, description: "Filter by specific version number" })
  @ApiQuery({
    name: "uploadedBy",
    required: false,
    type: String,
    description: "Filter by user who uploaded the version",
  })
  @ApiQuery({
    name: "riskStatus",
    required: false,
    enum: ["low_risk", "medium_risk", "high_risk", "under_review", "resolved", "no_risk"],
    description: "Filter by risk status of the version",
  })
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    description: "Filter by version creation date (start)",
  })
  @ApiQuery({ name: "endDate", required: false, type: String, description: "Filter by version creation date (end)" })
  @ApiQuery({ name: "page", required: false, type: Number, description: "Page number for pagination" })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Number of items per page" })
  @ApiQuery({
    name: "sortBy",
    required: false,
    type: String,
    description: "Field to sort by (e.g., createdAt, versionNumber)",
  })
  @ApiQuery({ name: "sortOrder", required: false, enum: ["ASC", "DESC"], description: "Sort order (ASC or DESC)" })
  async getDocumentVersions(@Param('documentId') documentId: string, @Query() filterDto: FilterDocumentVersionsDto) {
    const documentExists = await this.documentHistoryService.checkDocumentExists(documentId)
    if (!documentExists) {
      throw new NotFoundException(`Document with ID "${documentId}" not found.`)
    }
    return this.documentHistoryService.findDocumentVersions(documentId, filterDto)
  }

  @Get(":documentId/versions/:versionNumber")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Retrieve a specific version of a document" })
  @ApiResponse({ status: HttpStatus.OK, description: "Specific document version found.", type: DocumentVersion })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: "Document or version not found." })
  @ApiParam({ name: "documentId", type: String, description: "UUID of the document" })
  @ApiParam({ name: "versionNumber", type: Number, description: "Specific version number to retrieve" })
  async getSpecificDocumentVersion(
    @Param('documentId') documentId: string,
    @Param('versionNumber') versionNumber: number,
  ) {
    const version = await this.documentHistoryService.findSpecificDocumentVersion(documentId, versionNumber)
    if (!version) {
      throw new NotFoundException(`Version ${versionNumber} for document "${documentId}" not found.`)
    }
    return version
  }
}
