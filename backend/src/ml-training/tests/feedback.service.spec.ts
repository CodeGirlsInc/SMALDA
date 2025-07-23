import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { NotFoundException } from "@nestjs/common"
import { FeedbackService } from "../services/feedback.service"
import { Feedback, FeedbackType, FeedbackSource } from "../entities/feedback.entity"
import type { CreateFeedbackDto } from "../dto/create-feedback.dto"
import { jest } from "@jest/globals"

describe("FeedbackService", () => {
  let service: FeedbackService
  let repository: Repository<Feedback>

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        {
          provide: getRepositoryToken(Feedback),
          useValue: mockRepository,
        },
      ],
    }).compile()

    service = module.get<FeedbackService>(FeedbackService)
    repository = module.get<Repository<Feedback>>(getRepositoryToken(Feedback))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("create", () => {
    it("should create feedback", async () => {
      const datasetRecordId = "record-1"
      const createDto: CreateFeedbackDto = {
        type: FeedbackType.ACCURACY,
        source: FeedbackSource.HUMAN_REVIEWER,
        rating: 4,
        comments: "Good prediction",
        submittedBy: "user-1",
        submitterName: "John Doe",
      }

      const mockFeedback = {
        id: "1",
        ...createDto,
        datasetRecord: { id: datasetRecordId },
        createdAt: new Date(),
      }

      mockRepository.create.mockReturnValue(mockFeedback)
      mockRepository.save.mockResolvedValue(mockFeedback)

      const result = await service.create(datasetRecordId, createDto)

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createDto,
        datasetRecord: { id: datasetRecordId },
      })
      expect(result).toEqual(mockFeedback)
    })
  })

  describe("findByDatasetRecord", () => {
    it("should return feedback for a dataset record", async () => {
      const datasetRecordId = "record-1"
      const mockFeedback = [
        { id: "1", rating: 4, comments: "Good" },
        { id: "2", rating: 3, comments: "Average" },
      ]

      mockRepository.find.mockResolvedValue(mockFeedback)

      const result = await service.findByDatasetRecord(datasetRecordId)

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { datasetRecord: { id: datasetRecordId } },
        order: { createdAt: "DESC" },
      })
      expect(result).toEqual(mockFeedback)
    })
  })

  describe("getFeedbackStatistics", () => {
    it("should return feedback statistics", async () => {
      mockRepository.count.mockResolvedValue(100)
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)

      mockQueryBuilder.getRawMany
        .mockResolvedValueOnce([
          { type: FeedbackType.ACCURACY, count: "40" },
          { type: FeedbackType.QUALITY, count: "30" },
        ])
        .mockResolvedValueOnce([
          { source: FeedbackSource.HUMAN_REVIEWER, count: "60" },
          { source: FeedbackSource.AUTOMATED_SYSTEM, count: "40" },
        ])

      mockQueryBuilder.getRawOne.mockResolvedValue({ avgRating: "3.8" })

      mockRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(75) // useful for training

      const result = await service.getFeedbackStatistics()

      expect(result.totalFeedback).toBe(100)
      expect(result.averageRating).toBe(3.8)
      expect(result.usefulForTrainingCount).toBe(75)
      expect(result.typeBreakdown[FeedbackType.ACCURACY]).toBe(40)
      expect(result.sourceBreakdown[FeedbackSource.HUMAN_REVIEWER]).toBe(60)
    })
  })

  describe("getAverageRatingByDatasetRecord", () => {
    it("should return average rating for a dataset record", async () => {
      const datasetRecordId = "record-1"
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.getRawOne.mockResolvedValue({ avgRating: "4.2" })

      const result = await service.getAverageRatingByDatasetRecord(datasetRecordId)

      expect(result).toBe(4.2)
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("feedback.datasetRecordId = :datasetRecordId", {
        datasetRecordId,
      })
    })
  })

  describe("update", () => {
    it("should update feedback", async () => {
      const mockFeedback = {
        id: "1",
        rating: 3,
        comments: "Original comment",
      }

      const updateData = { rating: 4, comments: "Updated comment" }

      mockRepository.findOne.mockResolvedValue(mockFeedback)
      mockRepository.save.mockResolvedValue({ ...mockFeedback, ...updateData })

      const result = await service.update("1", updateData)

      expect(result.rating).toBe(4)
      expect(result.comments).toBe("Updated comment")
    })

    it("should throw NotFoundException when feedback not found", async () => {
      mockRepository.findOne.mockResolvedValue(null)

      await expect(service.update("1", { rating: 4 })).rejects.toThrow(NotFoundException)
    })
  })
})
