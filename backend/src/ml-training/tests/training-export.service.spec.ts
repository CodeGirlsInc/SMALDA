import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { NotFoundException } from "@nestjs/common"
import { TrainingExportService } from "../services/training-export.service"
import { TrainingExport, ExportFormat, ExportStatus } from "../entities/training-export.entity"
import { DatasetRecord, DatasetStatus, RiskLevel } from "../entities/dataset-record.entity"
import type { ExportTrainingDataDto } from "../dto/export-training-data.dto"
import { jest } from "@jest/globals"

// Mock fs/promises
jest.mock("fs/promises", () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  stat: jest.fn(),
  unlink: jest.fn(),
}))

describe("TrainingExportService", () => {
  let service: TrainingExportService
  let exportRepository: Repository<TrainingExport>
  let datasetRepository: Repository<DatasetRecord>

  const mockExportRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  }

  const mockDatasetRepository = {
    createQueryBuilder: jest.fn(),
  }

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingExportService,
        {
          provide: getRepositoryToken(TrainingExport),
          useValue: mockExportRepository,
        },
        {
          provide: getRepositoryToken(DatasetRecord),
          useValue: mockDatasetRepository,
        },
      ],
    }).compile()

    service = module.get<TrainingExportService>(TrainingExportService)
    exportRepository = module.get<Repository<TrainingExport>>(getRepositoryToken(TrainingExport))
    datasetRepository = module.get<Repository<DatasetRecord>>(getRepositoryToken(DatasetRecord))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("createExport", () => {
    it("should create a training export", async () => {
      const exportDto: ExportTrainingDataDto = {
        name: "Test Export",
        description: "Test export description",
        format: ExportFormat.JSON,
        statusFilter: [DatasetStatus.APPROVED],
        riskLevelFilter: [RiskLevel.HIGH],
      }

      const mockExport = {
        id: "export-1",
        ...exportDto,
        filters: service["buildFilters"](exportDto),
        exportedBy: "user-1",
        exporterName: "John Doe",
        status: ExportStatus.PENDING,
        createdAt: new Date(),
      }

      mockExportRepository.create.mockReturnValue(mockExport)
      mockExportRepository.save.mockResolvedValue(mockExport)

      // Mock the async processing
      jest.spyOn(service as any, "processExport").mockResolvedValue(undefined)

      const result = await service.createExport(exportDto, "user-1", "John Doe")

      expect(mockExportRepository.create).toHaveBeenCalledWith({
        name: exportDto.name,
        description: exportDto.description,
        format: exportDto.format,
        filters: expect.any(Object),
        exportedBy: "user-1",
        exporterName: "John Doe",
        status: ExportStatus.PENDING,
      })
      expect(result).toEqual(mockExport)
    })
  })

  describe("findOne", () => {
    it("should return a training export by id", async () => {
      const mockExport = {
        id: "export-1",
        name: "Test Export",
        status: ExportStatus.COMPLETED,
      }

      mockExportRepository.findOne.mockResolvedValue(mockExport)

      const result = await service.findOne("export-1")

      expect(mockExportRepository.findOne).toHaveBeenCalledWith({
        where: { id: "export-1" },
      })
      expect(result).toEqual(mockExport)
    })

    it("should throw NotFoundException when export not found", async () => {
      mockExportRepository.findOne.mockResolvedValue(null)

      await expect(service.findOne("export-1")).rejects.toThrow(NotFoundException)
    })
  })

  describe("downloadExport", () => {
    it("should return download info for completed export", async () => {
      const mockExport = {
        id: "export-1",
        name: "Test Export",
        format: ExportFormat.JSON,
        status: ExportStatus.COMPLETED,
        filePath: "/path/to/export.json",
      }

      mockExportRepository.findOne.mockResolvedValue(mockExport)

      const result = await service.downloadExport("export-1")

      expect(result).toEqual({
        filePath: "/path/to/export.json",
        fileName: "Test Export.json",
      })
    })

    it("should throw NotFoundException when export file not available", async () => {
      const mockExport = {
        id: "export-1",
        name: "Test Export",
        status: ExportStatus.PENDING,
        filePath: null,
      }

      mockExportRepository.findOne.mockResolvedValue(mockExport)

      await expect(service.downloadExport("export-1")).rejects.toThrow(NotFoundException)
    })
  })

  describe("formatExportData", () => {
    it("should format data as JSON", () => {
      const mockRecords = [
        {
          id: "record-1",
          inputData: "test input",
          features: { feature1: "value1" },
          predictedRiskLevel: RiskLevel.LOW,
          actualRiskLevel: RiskLevel.MEDIUM,
          tags: [{ name: "tag1", value: "value1", category: "risk_indicator", weight: 0.8 }],
          humanReviews: [],
          feedback: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as DatasetRecord[]

      const result = service["formatExportData"](mockRecords, ExportFormat.JSON)

      expect(result).toContain('"id": "record-1"')
      expect(result).toContain('"inputData": "test input"')
      expect(JSON.parse(result)).toHaveLength(1)
    })

    it("should format data as JSONL", () => {
      const mockRecords = [
        {
          id: "record-1",
          inputData: "test input 1",
          tags: [],
          humanReviews: [],
          feedback: [],
        },
        {
          id: "record-2",
          inputData: "test input 2",
          tags: [],
          humanReviews: [],
          feedback: [],
        },
      ] as DatasetRecord[]

      const result = service["formatExportData"](mockRecords, ExportFormat.JSONL)

      const lines = result.split("\n")
      expect(lines).toHaveLength(2)
      expect(JSON.parse(lines[0]).id).toBe("record-1")
      expect(JSON.parse(lines[1]).id).toBe("record-2")
    })
  })
})
