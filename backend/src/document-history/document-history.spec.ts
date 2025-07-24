import { Test, type TestingModule } from "@nestjs/testing"
import { DocumentHistoryController } from "./document-history.controller"
import { DocumentHistoryService } from "./document-history.service"
import { getRepositoryToken } from "@nestjs/typeorm"
import { Document } from "./entities/document.entity"
import { DocumentVersion } from "./entities/document-version.entity"
import type { Repository } from "typeorm"
import type { CreateDocumentDto } from "./dto/create-document.dto"
import type { UpdateDocumentDto } from "./dto/update-document.dto"
import type { FilterDocumentVersionsDto } from "./dto/filter-document-versions.dto"
import type { FilterDocumentsDto } from "./dto/filter-documents.dto" // NEW
import { DocumentType } from "./enums/document-type.enum"
import { RiskStatus } from "./enums/risk-status.enum"
import { NotFoundException, BadRequestException } from "@nestjs/common"
import { OcrExtractionService } from "../ocr-extraction/ocr-extraction.service"
import { TaggingService } from "../tagging/tagging.service" // NEW: Import TaggingService
import type { Tag } from "../tagging/entities/tag.entity" // NEW: Import Tag entity
import { jest } from "@jest/globals"

// Mock Repositories
const mockDocumentRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  softDelete: jest.fn(),
  manager: {
    transaction: jest.fn((cb) =>
      cb({
        save: jest.fn((entity) => Promise.resolve({ ...entity, id: entity.id || "new-uuid" })),
        softDelete: jest.fn(),
      }),
    ),
  },
  createQueryBuilder: jest.fn(() => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  })),
}

const mockDocumentVersionRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  softDelete: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  })),
}

const mockOcrExtractionService = {
  extractText: jest.fn(),
}

// NEW: Mock TaggingService
const mockTaggingService = {
  findOrCreateTags: jest.fn(),
}

describe("DocumentHistoryService", () => {
  let service: DocumentHistoryService
  let documentRepository: Repository<Document>
  let documentVersionRepository: Repository<DocumentVersion>
  let ocrExtractionService: OcrExtractionService
  let taggingService: TaggingService // NEW

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentHistoryService,
        {
          provide: getRepositoryToken(Document),
          useValue: mockDocumentRepository,
        },
        {
          provide: getRepositoryToken(DocumentVersion),
          useValue: mockDocumentVersionRepository,
        },
        {
          provide: OcrExtractionService,
          useValue: mockOcrExtractionService,
        },
        {
          provide: TaggingService, // NEW
          useValue: mockTaggingService,
        },
      ],
    }).compile()

    service = module.get<DocumentHistoryService>(DocumentHistoryService)
    documentRepository = module.get<Repository<Document>>(getRepositoryToken(Document))
    documentVersionRepository = module.get<Repository<DocumentVersion>>(getRepositoryToken(DocumentVersion))
    ocrExtractionService = module.get<OcrExtractionService>(OcrExtractionService)
    taggingService = module.get<TaggingService>(TaggingService) // NEW
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("createDocument", () => {
    it("should create a new document and its initial version, performing OCR and associating tags", async () => {
      const createDto: CreateDocumentDto = {
        name: "Test Document",
        documentType: DocumentType.SURVEY_PLAN,
        uploadedBy: "user-123",
        documentUrl: "http://example.com/doc1.pdf",
        riskReport: { score: 50, details: "medium risk" },
        riskStatus: RiskStatus.MEDIUM_RISK,
        tagNames: ["legal", "property"], // NEW
      }
      const extractedText = "OCR text from doc1.pdf"
      const mockTags: Tag[] = [{ id: "tag-1", name: "legal" } as Tag, { id: "tag-2", name: "property" } as Tag] // NEW

      mockOcrExtractionService.extractText.mockResolvedValue(extractedText)
      mockTaggingService.findOrCreateTags.mockResolvedValue(mockTags) // NEW

      const mockDocument = {
        id: "doc-uuid",
        ...createDto,
        currentVersionId: null,
        currentVersion: null,
        versions: [],
        tags: mockTags, // NEW
      }
      const mockVersion = {
        id: "version-uuid",
        documentId: "doc-uuid",
        versionNumber: 1,
        ...createDto,
        document: mockDocument,
        extractedText,
      }

      mockDocumentRepository.create.mockReturnValue(mockDocument)
      mockDocumentVersionRepository.create.mockReturnValue(mockVersion)
      mockDocumentRepository.manager.transaction.mockImplementation(async (cb) => {
        const entityManager = {
          save: jest.fn((entity) => {
            if (entity instanceof Document) return { ...entity, id: "doc-uuid" }
            if (entity instanceof DocumentVersion) return { ...entity, id: "version-uuid" }
            return entity
          }),
          softDelete: jest.fn(),
        }
        return cb(entityManager)
      })

      const result = await service.createDocument(createDto)

      expect(ocrExtractionService.extractText).toHaveBeenCalledWith(createDto.documentUrl)
      expect(mockTaggingService.findOrCreateTags).toHaveBeenCalledWith(createDto.tagNames) // NEW
      expect(mockDocumentVersionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          extractedText: extractedText,
        }),
      )
      expect(mockDocumentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: mockTags, // NEW
        }),
      )
      expect(result.currentVersion.extractedText).toBe(extractedText)
      expect(result.tags).toEqual(mockTags) // NEW
    })

    it("should create a new document and use provided extractedText without performing OCR and no tags", async () => {
      const createDto: CreateDocumentDto = {
        name: "Test Document",
        documentType: DocumentType.SURVEY_PLAN,
        uploadedBy: "user-123",
        documentUrl: "http://example.com/doc1.pdf",
        riskReport: { score: 50, details: "medium risk" },
        riskStatus: RiskStatus.MEDIUM_RISK,
        extractedText: "Pre-provided OCR text",
        tagNames: [], // NEW: No tags
      }
      const extractedText = "Pre-provided OCR text"

      mockOcrExtractionService.extractText.mockResolvedValue("Should not be called")
      mockTaggingService.findOrCreateTags.mockResolvedValue([]) // NEW

      const mockDocument = {
        id: "doc-uuid",
        ...createDto,
        currentVersionId: null,
        currentVersion: null,
        versions: [],
        tags: [], // NEW
      }
      const mockVersion = {
        id: "version-uuid",
        documentId: "doc-uuid",
        versionNumber: 1,
        ...createDto,
        document: mockDocument,
        extractedText,
      }

      mockDocumentRepository.create.mockReturnValue(mockDocument)
      mockDocumentVersionRepository.create.mockReturnValue(mockVersion)
      mockDocumentRepository.manager.transaction.mockImplementation(async (cb) => {
        const entityManager = {
          save: jest.fn((entity) => {
            if (entity instanceof Document) return { ...entity, id: "doc-uuid" }
            if (entity instanceof DocumentVersion) return { ...entity, id: "version-uuid" }
            return entity
          }),
          softDelete: jest.fn(),
        }
        return cb(entityManager)
      })

      const result = await service.createDocument(createDto)

      expect(ocrExtractionService.extractText).not.toHaveBeenCalled()
      expect(mockTaggingService.findOrCreateTags).toHaveBeenCalledWith([]) // NEW
      expect(mockDocumentVersionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          extractedText: extractedText,
        }),
      )
      expect(result.currentVersion.extractedText).toBe(extractedText)
      expect(result.tags).toEqual([]) // NEW
    })
  })

  describe("findAllDocuments", () => {
    it("should return all current documents with pagination, filters, and tags", async () => {
      const docList = [
        { id: "doc-1", name: "Doc A", currentVersion: { id: "v1", versionNumber: 1 }, tags: [{ name: "legal" }] },
      ]
      mockDocumentRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([docList, 1])

      const filterDto: FilterDocumentsDto = {
        name: "Doc",
        documentType: DocumentType.SURVEY_PLAN,
        tag: "legal", // NEW
        page: 1,
        limit: 10,
      }
      const result = await service.findAllDocuments(filterDto)

      const queryBuilderMock = mockDocumentRepository.createQueryBuilder()
      expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith("document.currentVersion", "currentVersion")
      expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith("document.tags", "tags") // NEW
      expect(queryBuilderMock.where).toHaveBeenCalledWith("document.deletedAt IS NULL")
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith("document.name ILIKE :name", { name: "%Doc%" })
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith("document.documentType = :documentType", {
        documentType: DocumentType.SURVEY_PLAN,
      })
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith("tags.name ILIKE :tag", { tag: "%legal%" }) // NEW
      expect(queryBuilderMock.orderBy).toHaveBeenCalledWith("document.createdAt", "DESC")
      expect(queryBuilderMock.skip).toHaveBeenCalledWith(0)
      expect(queryBuilderMock.take).toHaveBeenCalledWith(10)
      expect(result).toEqual({ data: docList, total: 1 })
    })
  })

  describe("findOneDocument", () => {
    it("should return a document with its current version and tags if found", async () => {
      const document = {
        id: "doc-1",
        name: "Doc A",
        currentVersion: { id: "v1", versionNumber: 1 },
        tags: [{ name: "legal" }],
      }
      mockDocumentRepository.findOne.mockResolvedValue(document)

      const result = await service.findOneDocument("doc-1")
      expect(mockDocumentRepository.findOne).toHaveBeenCalledWith({
        where: { id: "doc-1", deletedAt: null },
        relations: ["currentVersion", "tags"], // NEW
      })
      expect(result).toEqual(document)
    })

    it("should return undefined if document not found", async () => {
      mockDocumentRepository.findOne.mockResolvedValue(undefined)
      const result = await service.findOneDocument("non-existent-id")
      expect(result).toBeUndefined()
    })
  })

  describe("updateDocument", () => {
    it("should update document metadata, create a new version, perform OCR, and update tags", async () => {
      const existingDocument = {
        id: "doc-1",
        name: "Old Name",
        documentType: DocumentType.SURVEY_PLAN,
        currentVersion: {
          id: "v1",
          versionNumber: 1,
          uploadedBy: "user-old",
          documentUrl: "old.pdf",
          riskReport: {},
          riskStatus: RiskStatus.LOW_RISK,
          extractedText: "old text",
        },
        currentVersionId: "v1",
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [{ id: "tag-1", name: "old-tag" }], // Existing tags
      }
      const updateDto: UpdateDocumentDto = {
        name: "New Name",
        uploadedBy: "user-new",
        documentUrl: "new.pdf",
        riskReport: { score: 80 },
        riskStatus: RiskStatus.HIGH_RISK,
        uploadNotes: "Updated file and risk",
        tagNames: ["new-tag", "updated-tag"], // New tags
      }
      const extractedText = "OCR text from new.pdf"
      const newTags: Tag[] = [{ id: "tag-3", name: "new-tag" } as Tag, { id: "tag-4", name: "updated-tag" } as Tag] // NEW

      mockDocumentRepository.findOne.mockResolvedValue(existingDocument)
      mockOcrExtractionService.extractText.mockResolvedValue(extractedText)
      mockTaggingService.findOrCreateTags.mockResolvedValue(newTags) // NEW

      const newVersionMock = {
        id: "v2",
        versionNumber: 2,
        uploadedBy: "user-new",
        documentUrl: "new.pdf",
        riskReport: { score: 80 },
        riskStatus: RiskStatus.HIGH_RISK,
        uploadNotes: "Updated file and risk",
        extractedText,
      }

      mockDocumentVersionRepository.create.mockReturnValue(newVersionMock)
      mockDocumentRepository.manager.transaction.mockImplementation(async (cb) => {
        const entityManager = {
          save: jest.fn((entity) => {
            if (entity instanceof Document) return { ...entity, currentVersion: newVersionMock, currentVersionId: "v2" }
            if (entity instanceof DocumentVersion) return { ...entity, id: "v2" }
            return entity
          }),
          softDelete: jest.fn(),
        }
        return cb(entityManager)
      })

      const result = await service.updateDocument("doc-1", updateDto)

      expect(ocrExtractionService.extractText).toHaveBeenCalledWith(updateDto.documentUrl)
      expect(mockTaggingService.findOrCreateTags).toHaveBeenCalledWith(updateDto.tagNames) // NEW
      expect(mockDocumentVersionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          extractedText: extractedText,
        }),
      )
      expect(result.name).toBe("New Name")
      expect(result.currentVersion.id).toBe("v2")
      expect(result.currentVersion.versionNumber).toBe(2)
      expect(result.currentVersion.extractedText).toBe(extractedText)
      expect(result.tags).toEqual(newTags) // NEW
    })

    it("should update document metadata and use provided extractedText without performing OCR and no tags", async () => {
      const existingDocument = {
        id: "doc-1",
        name: "Old Name",
        documentType: DocumentType.SURVEY_PLAN,
        currentVersion: {
          id: "v1",
          versionNumber: 1,
          uploadedBy: "user-old",
          documentUrl: "old.pdf",
          riskReport: {},
          riskStatus: RiskStatus.LOW_RISK,
          extractedText: "old text",
        },
        currentVersionId: "v1",
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [{ id: "tag-1", name: "old-tag" }],
      }
      const updateDto: UpdateDocumentDto = {
        name: "New Name",
        uploadedBy: "user-new",
        documentUrl: "new.pdf",
        riskReport: { score: 80 },
        riskStatus: RiskStatus.HIGH_RISK,
        extractedText: "Pre-provided OCR text for update",
        tagNames: [], // NEW: No tags
      }
      const extractedText = "Pre-provided OCR text for update"

      mockDocumentRepository.findOne.mockResolvedValue(existingDocument)
      mockOcrExtractionService.extractText.mockResolvedValue("Should not be called")
      mockTaggingService.findOrCreateTags.mockResolvedValue([]) // NEW

      const newVersionMock = {
        id: "v2",
        versionNumber: 2,
        uploadedBy: "user-new",
        documentUrl: "new.pdf",
        riskReport: { score: 80 },
        riskStatus: RiskStatus.HIGH_RISK,
        extractedText,
      }

      mockDocumentVersionRepository.create.mockReturnValue(newVersionMock)
      mockDocumentRepository.manager.transaction.mockImplementation(async (cb) => {
        const entityManager = {
          save: jest.fn((entity) => {
            if (entity instanceof Document) return { ...entity, currentVersion: newVersionMock, currentVersionId: "v2" }
            if (entity instanceof DocumentVersion) return { ...entity, id: "v2" }
            return entity
          }),
          softDelete: jest.fn(),
        }
        return cb(entityManager)
      })

      const result = await service.updateDocument("doc-1", updateDto)

      expect(ocrExtractionService.extractText).not.toHaveBeenCalled()
      expect(mockTaggingService.findOrCreateTags).toHaveBeenCalledWith([]) // NEW
      expect(mockDocumentVersionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          extractedText: extractedText,
        }),
      )
      expect(result.currentVersion.extractedText).toBe(extractedText)
      expect(result.tags).toEqual([]) // NEW
    })

    it("should throw BadRequestException if required new version fields are missing", async () => {
      const existingDocument = {
        id: "doc-1",
        name: "Old Name",
        documentType: DocumentType.SURVEY_PLAN,
        currentVersion: {
          id: "v1",
          versionNumber: 1,
          uploadedBy: "user-old",
          documentUrl: "old.pdf",
          riskReport: {},
          riskStatus: RiskStatus.LOW_RISK,
        },
        currentVersionId: "v1",
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      }
      const updateDto: UpdateDocumentDto = {
        name: "New Name",
        uploadedBy: "user-new",
        documentUrl: "new.pdf",
        riskReport: { score: 80 },
        riskStatus: undefined, // Missing required field
      }

      mockDocumentRepository.findOne.mockResolvedValue(existingDocument)
      mockDocumentVersionRepository.create.mockReturnValue({ ...updateDto, versionNumber: 2 })

      await expect(service.updateDocument("doc-1", updateDto)).rejects.toThrow(BadRequestException)
    })

    it("should return undefined if document not found for update", async () => {
      mockDocumentRepository.findOne.mockResolvedValue(undefined)
      const updateDto: UpdateDocumentDto = {
        uploadedBy: "user-new",
        documentUrl: "new.pdf",
        riskReport: { score: 80 },
        riskStatus: RiskStatus.HIGH_RISK,
      }
      const result = await service.updateDocument("non-existent-id", updateDto)
      expect(result).toBeUndefined()
    })
  })

  describe("removeDocument", () => {
    it("should soft delete a document and its versions", async () => {
      const document = { id: "doc-1", name: "Test Doc" }
      mockDocumentRepository.findOne.mockResolvedValue(document)
      mockDocumentRepository.manager.transaction.mockImplementation(async (cb) => {
        const entityManager = {
          save: jest.fn(),
          softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
        }
        return cb(entityManager)
      })

      const result = await service.removeDocument("doc-1")
      expect(mockDocumentRepository.findOne).toHaveBeenCalledWith({ where: { id: "doc-1", deletedAt: null } })
      expect(mockDocumentRepository.manager.transaction).toHaveBeenCalled()
      expect(mockDocumentRepository.manager.transaction().softDelete).toHaveBeenCalledWith(DocumentVersion, {
        document: { id: "doc-1" },
      })
      expect(mockDocumentRepository.manager.transaction().softDelete).toHaveBeenCalledWith(Document, "doc-1")
      expect(result).toBe(true)
    })

    it("should return false if document not found for deletion", async () => {
      mockDocumentRepository.findOne.mockResolvedValue(undefined)
      const result = await service.removeDocument("non-existent-id")
      expect(result).toBe(false)
    })
  })

  describe("findDocumentVersions", () => {
    it("should return all versions for a document with filters and pagination", async () => {
      const versions = [
        { id: "v1", versionNumber: 1 },
        { id: "v2", versionNumber: 2 },
      ]
      mockDocumentVersionRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([versions, 2])

      const filterDto: FilterDocumentVersionsDto = {
        versionNumber: 1,
        uploadedBy: "user-123",
        riskStatus: RiskStatus.LOW_RISK,
        page: 1,
        limit: 5,
      }
      const result = await service.findDocumentVersions("doc-1", filterDto)

      const queryBuilderMock = mockDocumentVersionRepository.createQueryBuilder()
      expect(queryBuilderMock.where).toHaveBeenCalledWith("version.documentId = :documentId", { documentId: "doc-1" })
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith("version.versionNumber = :versionNumber", {
        versionNumber: 1,
      })
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith("version.uploadedBy = :uploadedBy", {
        uploadedBy: "user-123",
      })
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith("version.riskStatus = :riskStatus", {
        riskStatus: RiskStatus.LOW_RISK,
      })
      expect(queryBuilderMock.orderBy).toHaveBeenCalledWith("version.createdAt", "DESC")
      expect(queryBuilderMock.skip).toHaveBeenCalledWith(0)
      expect(queryBuilderMock.take).toHaveBeenCalledWith(5)
      expect(result).toEqual({ data: versions, total: 2 })
    })
  })

  describe("findSpecificDocumentVersion", () => {
    it("should return a specific version if found", async () => {
      const version = { id: "v1", versionNumber: 1, documentId: "doc-1" }
      mockDocumentVersionRepository.findOne.mockResolvedValue(version)

      const result = await service.findSpecificDocumentVersion("doc-1", 1)
      expect(mockDocumentVersionRepository.findOne).toHaveBeenCalledWith({
        where: { document: { id: "doc-1" }, versionNumber: 1 },
      })
      expect(result).toEqual(version)
    })

    it("should return undefined if specific version not found", async () => {
      mockDocumentVersionRepository.findOne.mockResolvedValue(undefined)
      const result = await service.findSpecificDocumentVersion("doc-1", 99)
      expect(result).toBeUndefined()
    })
  })

  describe("checkDocumentExists", () => {
    it("should return true if document exists", async () => {
      mockDocumentRepository.count.mockResolvedValue(1)
      const result = await service.checkDocumentExists("doc-1")
      expect(result).toBe(true)
    })

    it("should return false if document does not exist", async () => {
      mockDocumentRepository.count.mockResolvedValue(0)
      const result = await service.checkDocumentExists("non-existent-id")
      expect(result).toBe(false)
    })
  })
})

describe("DocumentHistoryController", () => {
  let controller: DocumentHistoryController
  let service: DocumentHistoryService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentHistoryController],
      providers: [
        {
          provide: DocumentHistoryService,
          useValue: {
            createDocument: jest.fn(),
            findAllDocuments: jest.fn(),
            findOneDocument: jest.fn(),
            updateDocument: jest.fn(),
            removeDocument: jest.fn(),
            findDocumentVersions: jest.fn(),
            findSpecificDocumentVersion: jest.fn(),
            checkDocumentExists: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get<DocumentHistoryController>(DocumentHistoryController)
    service = module.get<DocumentHistoryService>(DocumentHistoryService)
  })

  it("should be defined", () => {
    expect(controller).toBeDefined()
  })

  describe("create", () => {
    it("should create a document and its initial version with tags", async () => {
      const createDto: CreateDocumentDto = {
        name: "New Doc",
        documentType: DocumentType.AGREEMENT,
        uploadedBy: "user-abc",
        documentUrl: "url.pdf",
        riskReport: {},
        riskStatus: RiskStatus.NO_RISK,
        extractedText: "Some extracted text",
        tagNames: ["contract", "legal"], // NEW
      }
      const expectedDoc = {
        id: "doc-1",
        ...createDto,
        currentVersion: { id: "v1", versionNumber: 1, extractedText: "Some extracted text" },
        tags: [{ id: "tag-1", name: "contract" }], // Simplified mock tags
      }
      jest.spyOn(service, "createDocument").mockResolvedValue(expectedDoc as Document)

      const result = await controller.create(createDto)
      expect(service.createDocument).toHaveBeenCalledWith(createDto)
      expect(result).toEqual(expectedDoc)
    })
  })

  describe("findAllCurrent", () => {
    it("should return all current documents with tag filter", async () => {
      const filterDto: FilterDocumentsDto = { page: 1, limit: 10, tag: "legal" } // NEW
      const docList = {
        data: [{ id: "doc-1", name: "Doc A", currentVersion: { id: "v1" }, tags: [{ name: "legal" }] }],
        total: 1,
      }
      jest.spyOn(service, "findAllDocuments").mockResolvedValue(docList as any)

      const result = await controller.findAllCurrent(filterDto)
      expect(service.findAllDocuments).toHaveBeenCalledWith(filterDto)
      expect(result).toEqual(docList)
    })
  })

  describe("findOne", () => {
    it("should return a single document with its current version and tags", async () => {
      const document = {
        id: "doc-1",
        name: "Doc A",
        currentVersion: { id: "v1" },
        tags: [{ name: "finance" }],
      }
      jest.spyOn(service, "findOneDocument").mockResolvedValue(document as Document)

      const result = await controller.findOne("doc-1")
      expect(service.findOneDocument).toHaveBeenCalledWith("doc-1")
      expect(result).toEqual(document)
    })

    it("should throw NotFoundException if document not found", async () => {
      jest.spyOn(service, "findOneDocument").mockResolvedValue(undefined)
      await expect(controller.findOne("non-existent-id")).rejects.toThrow(NotFoundException)
    })
  })

  describe("update", () => {
    it("should update a document and create a new version with tags", async () => {
      const updateDto: UpdateDocumentDto = {
        uploadedBy: "user-new",
        documentUrl: "new.pdf",
        riskReport: { score: 70 },
        riskStatus: RiskStatus.HIGH_RISK,
        extractedText: "Updated extracted text",
        tagNames: ["updated-tag"], // NEW
      }
      const updatedDoc = {
        id: "doc-1",
        name: "Updated Doc",
        currentVersion: { id: "v2", versionNumber: 2, extractedText: "Updated extracted text" },
        tags: [{ id: "tag-2", name: "updated-tag" }], // Simplified mock tags
      }
      jest.spyOn(service, "updateDocument").mockResolvedValue(updatedDoc as Document)

      const result = await controller.update("doc-1", updateDto)
      expect(service.updateDocument).toHaveBeenCalledWith("doc-1", updateDto)
      expect(result).toEqual(updatedDoc)
    })

    it("should throw NotFoundException if document not found for update", async () => {
      jest.spyOn(service, "updateDocument").mockResolvedValue(undefined)
      await expect(controller.update("non-existent-id", {} as UpdateDocumentDto)).rejects.toThrow(NotFoundException)
    })
  })

  describe("remove", () => {
    it("should soft delete a document and its versions", async () => {
      jest.spyOn(service, "removeDocument").mockResolvedValue(true)
      const result = await controller.remove("doc-1")
      expect(service.removeDocument).toHaveBeenCalledWith("doc-1")
      expect(result).toBeUndefined()
    })

    it("should throw NotFoundException if document not found for removal", async () => {
      jest.spyOn(service, "removeDocument").mockResolvedValue(false)
      await expect(controller.remove("non-existent-id")).rejects.toThrow(NotFoundException)
    })
  })

  describe("getDocumentVersions", () => {
    it("should return all versions for a document", async () => {
      const versions = { data: [{ id: "v1", versionNumber: 1 }], total: 1 }
      jest.spyOn(service, "checkDocumentExists").mockResolvedValue(true)
      jest.spyOn(service, "findDocumentVersions").mockResolvedValue(versions as any)

      const result = await controller.getDocumentVersions("doc-1", {})
      expect(service.checkDocumentExists).toHaveBeenCalledWith("doc-1")
      expect(service.findDocumentVersions).toHaveBeenCalledWith("doc-1", {})
      expect(result).toEqual(versions)
    })

    it("should throw NotFoundException if document not found for versions", async () => {
      jest.spyOn(service, "checkDocumentExists").mockResolvedValue(false)
      await expect(controller.getDocumentVersions("non-existent-id", {})).rejects.toThrow(NotFoundException)
    })
  })

  describe("getSpecificDocumentVersion", () => {
    it("should return a specific version of a document", async () => {
      const version = { id: "v1", versionNumber: 1, documentId: "doc-1" }
      jest.spyOn(service, "findSpecificDocumentVersion").mockResolvedValue(version as DocumentVersion)

      const result = await controller.getSpecificDocumentVersion("doc-1", 1)
      expect(service.findSpecificDocumentVersion).toHaveBeenCalledWith("doc-1", 1)
      expect(result).toEqual(version)
    })

    it("should throw NotFoundException if specific version not found", async () => {
      jest.spyOn(service, "findSpecificDocumentVersion").mockResolvedValue(undefined)
      await expect(controller.getSpecificDocumentVersion("doc-1", 99)).rejects.toThrow(NotFoundException)
    })
  })
})
