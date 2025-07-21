import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import type { Repository } from "typeorm"
import { ArchivingService } from "./archiving.service"
import { ArchivedDocument, ArchivePolicy, ArchiveJob } from "./entities/archived-document.entity"
import { ArchiveStorageService } from "./services/archive-storage.service"
import { ArchiveSchedulerService } from "./services/archive-scheduler.service"
import { ArchiveReason, ArchiveStatus } from "./entities/archived-document.entity"
import { jest } from "@jest/globals"

describe("ArchivingService", () => {
  let service: ArchivingService
  let archivedDocumentRepository: Repository<ArchivedDocument>
  let archivePolicyRepository: Repository<ArchivePolicy>
  let archiveJobRepository: Repository<ArchiveJob>
  let archiveStorageService: ArchiveStorageService
  let archiveSchedulerService: ArchiveSchedulerService

  const mockArchivedDocumentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const mockArchivePolicyRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  }

  const mockArchiveJobRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  }

  const mockArchiveStorageService = {
    archiveDocument: jest.fn(),
    restoreDocument: jest.fn(),
    deleteArchivedDocument: jest.fn(),
    getStorageStats: jest.fn(),
  }

  const mockArchiveSchedulerService = {
    startScheduler: jest.fn(),
    stopScheduler: jest.fn(),
  }

  const mockQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    select: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchivingService,
        {
          provide: getRepositoryToken(ArchivedDocument),
          useValue: mockArchivedDocumentRepository,
        },
        {
          provide: getRepositoryToken(ArchivePolicy),
          useValue: mockArchivePolicyRepository,
        },
        {
          provide: getRepositoryToken(ArchiveJob),
          useValue: mockArchiveJobRepository,
        },
        {
          provide: ArchiveStorageService,
          useValue: mockArchiveStorageService,
        },
        {
          provide: ArchiveSchedulerService,
          useValue: mockArchiveSchedulerService,
        },
      ],
    }).compile()

    service = module.get<ArchivingService>(ArchivingService)
    archivedDocumentRepository = module.get<Repository<ArchivedDocument>>(getRepositoryToken(ArchivedDocument))
    archivePolicyRepository = module.get<Repository<ArchivePolicy>>(getRepositoryToken(ArchivePolicy))
    archiveJobRepository = module.get<Repository<ArchiveJob>>(getRepositoryToken(ArchiveJob))
    archiveStorageService = module.get<ArchiveStorageService>(ArchiveStorageService)
    archiveSchedulerService = module.get<ArchiveSchedulerService>(ArchiveSchedulerService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("onModuleInit", () => {
    it("should start the scheduler", async () => {
      await service.onModuleInit()

      expect(archiveSchedulerService.startScheduler).toHaveBeenCalled()
    })
  })

  describe("onModuleDestroy", () => {
    it("should stop the scheduler", async () => {
      await service.onModuleDestroy()

      expect(archiveSchedulerService.stopScheduler).toHaveBeenCalled()
    })
  })

  describe("archiveDocument", () => {
    const documentId = "doc-123"
    const reason = ArchiveReason.INACTIVE_PERIOD
    const archivedBy = "user-123"

    const mockOriginalDocument = {
      id: documentId,
      originalName: "test.pdf",
      documentType: "BILL_OF_LADING",
      shipmentId: "shipment-123",
      uploadedBy: "user-456",
    }

    const mockStorageResult = {
      archiveLocation: "/archives/doc-123.gz",
      originalSize: 1024,
      compressedSize: 512,
      compressionRatio: 2,
      checksum: "abc123",
    }

    beforeEach(() => {
      // Mock the private method getOriginalDocument
      jest.spyOn(service as any, "getOriginalDocument").mockResolvedValue(mockOriginalDocument)
      jest.spyOn(service as any, "removeFromOriginalTable").mockResolvedValue(undefined)
    })

    it("should successfully archive a document", async () => {
      const mockArchivedDocument = {
        id: "archive-123",
        originalDocumentId: documentId,
        status: ArchiveStatus.ARCHIVED,
      }

      mockArchivedDocumentRepository.findOne.mockResolvedValue(null) // No existing archive
      mockArchiveStorageService.archiveDocument.mockResolvedValue(mockStorageResult)
      mockArchivedDocumentRepository.create.mockReturnValue(mockArchivedDocument)
      mockArchivedDocumentRepository.save.mockResolvedValue(mockArchivedDocument)

      const result = await service.archiveDocument(documentId, reason, archivedBy)

      expect(archiveStorageService.archiveDocument).toHaveBeenCalledWith(documentId, mockOriginalDocument, true)
      expect(archivedDocumentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          originalDocumentId: documentId,
          archiveReason: reason,
          archivedBy,
          status: ArchiveStatus.ARCHIVED,
        }),
      )
      expect(result).toEqual(mockArchivedDocument)
    })

    it("should throw BadRequestException if document is already archived", async () => {
      const existingArchive = { id: "existing-123", originalDocumentId: documentId }
      mockArchivedDocumentRepository.findOne.mockResolvedValue(existingArchive)

      await expect(service.archiveDocument(documentId, reason, archivedBy)).rejects.toThrow(BadRequestException)
      expect(archiveStorageService.archiveDocument).not.toHaveBeenCalled()
    })

    it("should throw NotFoundException if original document not found", async () => {
      jest.spyOn(service as any, "getOriginalDocument").mockResolvedValue(null)

      await expect(service.archiveDocument(documentId, reason, archivedBy)).rejects.toThrow(NotFoundException)
    })
  })

  describe("restoreDocument", () => {
    const archivedDocumentId = "archive-123"
    const restoredBy = "user-123"

    const mockArchivedDocument = {
      id: archivedDocumentId,
      originalDocumentId: "doc-123",
      status: ArchiveStatus.ARCHIVED,
      archiveLocation: "/archives/doc-123.gz",
      compressionRatio: 2,
    }

    const mockRestoredData = {
      id: "doc-123",
      originalName: "test.pdf",
    }

    beforeEach(() => {
      jest.spyOn(service as any, "restoreToOriginalTable").mockResolvedValue(mockRestoredData)
    })

    it("should successfully restore a document", async () => {
      mockArchivedDocumentRepository.findOne.mockResolvedValue(mockArchivedDocument)
      mockArchiveStorageService.restoreDocument.mockResolvedValue(mockRestoredData)
      mockArchivedDocumentRepository.save.mockResolvedValue({
        ...mockArchivedDocument,
        status: ArchiveStatus.RESTORED,
      })

      const result = await service.restoreDocument(archivedDocumentId, restoredBy)

      expect(archiveStorageService.restoreDocument).toHaveBeenCalledWith(
        mockArchivedDocument.archiveLocation,
        true, // isCompressed
      )
      expect(archivedDocumentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ArchiveStatus.RESTORED,
          restoredBy,
        }),
      )
      expect(result).toEqual(mockRestoredData)
    })

    it("should throw NotFoundException if archived document not found", async () => {
      mockArchivedDocumentRepository.findOne.mockResolvedValue(null)

      await expect(service.restoreDocument(archivedDocumentId, restoredBy)).rejects.toThrow(NotFoundException)
    })

    it("should throw BadRequestException if document is not in archived status", async () => {
      const restoredDocument = {
        ...mockArchivedDocument,
        status: ArchiveStatus.RESTORED,
      }
      mockArchivedDocumentRepository.findOne.mockResolvedValue(restoredDocument)

      await expect(service.restoreDocument(archivedDocumentId, restoredBy)).rejects.toThrow(BadRequestException)
    })

    it("should revert status on restoration failure", async () => {
      mockArchivedDocumentRepository.findOne.mockResolvedValue(mockArchivedDocument)
      mockArchiveStorageService.restoreDocument.mockRejectedValue(new Error("Storage error"))
      mockArchivedDocumentRepository.save.mockResolvedValue(mockArchivedDocument)

      await expect(service.restoreDocument(archivedDocumentId, restoredBy)).rejects.toThrow(BadRequestException)

      expect(archivedDocumentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ArchiveStatus.ARCHIVED, // Reverted back
        }),
      )
    })
  })

  describe("findArchivedDocuments", () => {
    it("should return paginated archived documents with filters", async () => {
      const queryDto = {
        documentType: "BILL_OF_LADING",
        status: ArchiveStatus.ARCHIVED,
        limit: 10,
        offset: 0,
      }

      const mockDocuments = [{ id: "archive-1" }, { id: "archive-2" }]

      mockArchivedDocumentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockDocuments, 2])

      const result = await service.findArchivedDocuments(queryDto)

      expect(archivedDocumentRepository.createQueryBuilder).toHaveBeenCalledWith("archived_document")
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith("archived_document.documentType = :documentType", {
        documentType: "BILL_OF_LADING",
      })
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith("archived_document.status = :status", {
        status: ArchiveStatus.ARCHIVED,
      })
      expect(result).toEqual({ documents: mockDocuments, total: 2 })
    })
  })

  describe("getArchiveStats", () => {
    it("should return archive statistics", async () => {
      const mockStats = [
        {
          documentType: "BILL_OF_LADING",
          archiveReason: "INACTIVE_PERIOD",
          status: "ARCHIVED",
          count: "5",
          totalSize: "5120",
          avgCompressionRatio: "2.5",
        },
      ]

      const mockStorageStats = {
        totalArchives: 10,
        totalSize: 10240,
        averageCompressionRatio: 2.3,
      }

      mockArchivedDocumentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.getRawMany.mockResolvedValue(mockStats)
      mockArchiveStorageService.getStorageStats.mockResolvedValue(mockStorageStats)

      const result = await service.getArchiveStats()

      expect(result.documentStats).toEqual(mockStats)
      expect(result.storageStats).toEqual(mockStorageStats)
      expect(result.totalArchived).toBe(5)
    })
  })
})
