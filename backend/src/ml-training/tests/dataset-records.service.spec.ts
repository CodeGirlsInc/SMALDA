import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { NotFoundException } from "@nestjs/common"
import { DatasetRecordsService } from "../services/dataset-records.service"
import { DatasetRecord, DatasetStatus, RiskLevel } from "../entities/dataset-record.entity"
import type { CreateDatasetRecordDto } from "../dto/create-dataset-record.dto"
import { jest } from "@jest/globals"

describe("DatasetRecordsService", () => {
  let service: DatasetRecordsService
  let repository: Repository<DatasetRecord>

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatasetRecordsService,
        {
          provide: getRepositoryToken(DatasetRecord),
          useValue: mockRepository,
        },
      ],
    }).compile()

    service = module.get<DatasetRecordsService>(DatasetRecordsService)
    repository = module.get<Repository<DatasetRecord>>(getRepositoryToken(DatasetRecord))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("create", () => {
    it("should create a dataset record", async () => {
      const createDto: CreateDatasetRecordDto = {
        inputData: "test input",
        predictedRiskLevel: RiskLevel.LOW,
        actualRiskLevel: RiskLevel.MEDIUM,
        confidenceScore: 0.85,
      }

      const mockRecord = {
        id: "1",
        ...createDto,
        status: DatasetStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockRepository.create.mockReturnValue(mockRecord)
      mockRepository.save.mockResolvedValue(mockRecord)

      const result = await service.create(createDto)

      expect(mockRepository.create).toHaveBeenCalledWith(createDto)
      expect(mockRepository.save).toHaveBeenCalledWith(mockRecord)
      expect(result).toEqual(mockRecord)
    })
  })

  describe("findAll", () => {
    it("should return paginated dataset records", async () => {
      const mockRecords = [
        { id: "1", inputData: "test1", status: DatasetStatus.PENDING },
        { id: "2", inputData: "test2", status: DatasetStatus.REVIEWED },
      ]

      mockRepository.findAndCount.mockResolvedValue([mockRecords, 2])

      const result = await service.findAll(1, 10)

      expect(result).toEqual({
        data: mockRecords,
        total: 2,
        page: 1,
        limit: 10,
      })
    })

    it("should apply filters correctly", async () => {
      const filters = {
        status: [DatasetStatus.PENDING],
        riskLevel: [RiskLevel.HIGH],
      }

      mockRepository.findAndCount.mockResolvedValue([[], 0])

      await service.findAll(1, 10, filters)

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: DatasetStatus.PENDING,
            actualRiskLevel: RiskLevel.HIGH,
          }),
        }),
      )
    })
  })

  describe("findOne", () => {
    it("should return a dataset record by id", async () => {
      const mockRecord = {
        id: "1",
        inputData: "test",
        tags: [],
        humanReviews: [],
        feedback: [],
      }

      mockRepository.findOne.mockResolvedValue(mockRecord)

      const result = await service.findOne("1")

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: "1" },
        relations: ["tags", "humanReviews", "feedback"],
      })
      expect(result).toEqual(mockRecord)
    })

    it("should throw NotFoundException when record not found", async () => {
      mockRepository.findOne.mockResolvedValue(null)

      await expect(service.findOne("1")).rejects.toThrow(NotFoundException)
    })
  })

  describe("getStatistics", () => {
    it("should return dataset statistics", async () => {
      mockRepository.count.mockResolvedValue(100)
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)

      mockQueryBuilder.getRawMany
        .mockResolvedValueOnce([
          { status: DatasetStatus.PENDING, count: "50" },
          { status: DatasetStatus.REVIEWED, count: "30" },
        ])
        .mockResolvedValueOnce([
          { riskLevel: RiskLevel.LOW, count: "40" },
          { riskLevel: RiskLevel.HIGH, count: "20" },
        ])

      mockRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(60) // training
        .mockResolvedValueOnce(25) // validation
        .mockResolvedValueOnce(15) // test

      const result = await service.getStatistics()

      expect(result.totalRecords).toBe(100)
      expect(result.trainingDataCount).toBe(60)
      expect(result.validationDataCount).toBe(25)
      expect(result.testDataCount).toBe(15)
    })
  })

  describe("update", () => {
    it("should update a dataset record", async () => {
      const mockRecord = {
        id: "1",
        inputData: "test",
        status: DatasetStatus.PENDING,
      }

      const updateDto = { status: DatasetStatus.REVIEWED }

      mockRepository.findOne.mockResolvedValue(mockRecord)
      mockRepository.save.mockResolvedValue({ ...mockRecord, ...updateDto })

      const result = await service.update("1", updateDto)

      expect(result.status).toBe(DatasetStatus.REVIEWED)
    })
  })

  describe("bulkUpdateStatus", () => {
    it("should update status for multiple records", async () => {
      const ids = ["1", "2", "3"]
      const status = DatasetStatus.APPROVED

      await service.bulkUpdateStatus(ids, status)

      expect(mockRepository.update).toHaveBeenCalledWith(ids, { status })
    })
  })
})
