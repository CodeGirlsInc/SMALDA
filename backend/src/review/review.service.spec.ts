import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ReviewService } from "./services/review.service"
import { Review } from "./entities/review.entity"
import { ReviewComment } from "./entities/review-comment.entity"
import { DocumentService } from "../document/services/document.service"
import type { CreateReviewDto } from "./dto/create-review.dto"
import type { UpdateReviewDto } from "./dto/update-review.dto"
import type { AddCommentDto } from "./dto/add-comment.dto"
import type { ReviewQueryDto } from "./dto/review-query.dto"
import { ReviewStatus, ReviewDecision, RiskLevel, CommentType } from "./enums/review.enums"
import { NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common"
import { jest } from "@jest/globals" // Import jest to declare it

describe("ReviewService", () => {
  let service: ReviewService
  let reviewRepository: Repository<Review>
  let commentRepository: Repository<ReviewComment>
  let documentService: DocumentService

  const mockReview: Partial<Review> = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    documentId: "123e4567-e89b-12d3-a456-426614174001",
    reviewerId: "123e4567-e89b-12d3-a456-426614174002",
    status: ReviewStatus.PENDING,
    aiRiskLevel: RiskLevel.MEDIUM,
    aiConfidenceScore: 0.75,
    aiDetectionDetails: { reason: "suspicious content" },
    reviewMetadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockComment: Partial<ReviewComment> = {
    id: "123e4567-e89b-12d3-a456-426614174003",
    reviewId: "123e4567-e89b-12d3-a456-426614174000",
    authorId: "123e4567-e89b-12d3-a456-426614174002",
    content: "Test comment",
    type: CommentType.GENERAL,
    isInternal: false,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockReviewRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getCount: jest.fn(),
      clone: jest.fn().mockReturnThis(),
    })),
  }

  const mockCommentRepository = {
    create: jest.fn(),
    save: jest.fn(),
  }

  const mockDocumentService = {
    findOne: jest.fn(),
    updateStatus: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        {
          provide: getRepositoryToken(Review),
          useValue: mockReviewRepository,
        },
        {
          provide: getRepositoryToken(ReviewComment),
          useValue: mockCommentRepository,
        },
        {
          provide: DocumentService,
          useValue: mockDocumentService,
        },
      ],
    }).compile()

    service = module.get<ReviewService>(ReviewService)
    reviewRepository = module.get<Repository<Review>>(getRepositoryToken(Review))
    commentRepository = module.get<Repository<ReviewComment>>(getRepositoryToken(ReviewComment))
    documentService = module.get<DocumentService>(DocumentService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("createReview", () => {
    const createReviewDto: CreateReviewDto = {
      documentId: "123e4567-e89b-12d3-a456-426614174001",
      reviewerId: "123e4567-e89b-12d3-a456-426614174002",
      aiRiskLevel: RiskLevel.MEDIUM,
      aiConfidenceScore: 0.75,
      aiDetectionDetails: { reason: "suspicious content" },
    }

    it("should create a review successfully", async () => {
      mockDocumentService.findOne.mockResolvedValue({ id: createReviewDto.documentId })
      mockReviewRepository.findOne.mockResolvedValue(null)
      mockReviewRepository.create.mockReturnValue(mockReview)
      mockReviewRepository.save.mockResolvedValue(mockReview)

      const result = await service.createReview(createReviewDto)

      expect(mockDocumentService.findOne).toHaveBeenCalledWith(createReviewDto.documentId)
      expect(mockReviewRepository.findOne).toHaveBeenCalledWith({
        where: { documentId: createReviewDto.documentId },
      })
      expect(mockReviewRepository.create).toHaveBeenCalledWith({
        ...createReviewDto,
        status: ReviewStatus.PENDING,
        reviewMetadata: expect.objectContaining({
          createdBy: "system",
          source: "ai_detection",
        }),
      })
      expect(mockReviewRepository.save).toHaveBeenCalledWith(mockReview)
      expect(result).toEqual(mockReview)
    })

    it("should throw BadRequestException if review already exists", async () => {
      mockDocumentService.findOne.mockResolvedValue({ id: createReviewDto.documentId })
      mockReviewRepository.findOne.mockResolvedValue(mockReview)

      await expect(service.createReview(createReviewDto)).rejects.toThrow(BadRequestException)
    })
  })

  describe("findAll", () => {
    const queryDto: ReviewQueryDto = {
      page: 1,
      limit: 10,
      status: ReviewStatus.PENDING,
    }

    it("should return paginated reviews", async () => {
      const mockQueryBuilder = mockReviewRepository.createQueryBuilder()
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockReview], 1])

      const result = await service.findAll(queryDto)

      expect(result).toEqual({
        reviews: [mockReview],
        total: 1,
        page: 1,
        limit: 10,
      })
    })
  })

  describe("findOne", () => {
    it("should return a review by id", async () => {
      mockReviewRepository.findOne.mockResolvedValue(mockReview)

      const result = await service.findOne(mockReview.id)

      expect(mockReviewRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockReview.id },
        relations: ["comments", "comments.author"],
      })
      expect(result).toEqual(mockReview)
    })

    it("should throw NotFoundException if review not found", async () => {
      mockReviewRepository.findOne.mockResolvedValue(null)

      await expect(service.findOne("non-existent-id")).rejects.toThrow(NotFoundException)
    })
  })

  describe("updateReview", () => {
    const updateReviewDto: UpdateReviewDto = {
      status: ReviewStatus.COMPLETED,
      decision: ReviewDecision.APPROVE,
      reviewerNotes: "Approved after review",
    }

    it("should update a review successfully", async () => {
      const reviewWithComments = { ...mockReview, comments: [] }
      mockReviewRepository.findOne.mockResolvedValue(reviewWithComments)
      mockReviewRepository.save.mockResolvedValue({
        ...reviewWithComments,
        ...updateReviewDto,
      })
      mockDocumentService.updateStatus.mockResolvedValue(undefined)

      const result = await service.updateReview(mockReview.id, updateReviewDto, mockReview.reviewerId)

      expect(mockReviewRepository.save).toHaveBeenCalled()
      expect(mockDocumentService.updateStatus).toHaveBeenCalledWith(mockReview.documentId, updateReviewDto.decision)
      expect(result.status).toBe(updateReviewDto.status)
    })

    it("should throw ForbiddenException if reviewer does not match", async () => {
      const reviewWithComments = { ...mockReview, comments: [] }
      mockReviewRepository.findOne.mockResolvedValue(reviewWithComments)

      await expect(service.updateReview(mockReview.id, updateReviewDto, "different-reviewer-id")).rejects.toThrow(
        ForbiddenException,
      )
    })
  })

  describe("addComment", () => {
    const addCommentDto: AddCommentDto = {
      content: "Test comment",
      type: CommentType.GENERAL,
      isInternal: false,
    }

    it("should add a comment successfully", async () => {
      const reviewWithComments = { ...mockReview, comments: [] }
      mockReviewRepository.findOne.mockResolvedValue(reviewWithComments)
      mockCommentRepository.create.mockReturnValue(mockComment)
      mockCommentRepository.save.mockResolvedValue(mockComment)

      const result = await service.addComment(mockReview.id, addCommentDto, mockComment.authorId)

      expect(mockCommentRepository.create).toHaveBeenCalledWith({
        ...addCommentDto,
        reviewId: mockReview.id,
        authorId: mockComment.authorId,
        metadata: expect.objectContaining({
          createdBy: mockComment.authorId,
          reviewStatus: mockReview.status,
        }),
      })
      expect(mockCommentRepository.save).toHaveBeenCalledWith(mockComment)
      expect(result).toEqual(mockComment)
    })
  })

  describe("approveReview", () => {
    it("should approve a review with low/medium risk", async () => {
      const reviewWithComments = { ...mockReview, comments: [] }
      mockReviewRepository.findOne.mockResolvedValue(reviewWithComments)
      mockReviewRepository.save.mockResolvedValue({
        ...reviewWithComments,
        status: ReviewStatus.COMPLETED,
        decision: ReviewDecision.APPROVE,
      })
      mockDocumentService.updateStatus.mockResolvedValue(undefined)

      const result = await service.approveReview(mockReview.id, mockReview.reviewerId, "Looks good")

      expect(result.status).toBe(ReviewStatus.COMPLETED)
      expect(result.decision).toBe(ReviewDecision.APPROVE)
    })

    it("should override approve a review with high/critical risk", async () => {
      const highRiskReview = { ...mockReview, aiRiskLevel: RiskLevel.HIGH, comments: [] }
      mockReviewRepository.findOne.mockResolvedValue(highRiskReview)
      mockReviewRepository.save.mockResolvedValue({
        ...highRiskReview,
        status: ReviewStatus.COMPLETED,
        decision: ReviewDecision.OVERRIDE_APPROVE,
      })
      mockDocumentService.updateStatus.mockResolvedValue(undefined)

      const result = await service.approveReview(mockReview.id, mockReview.reviewerId, "Override approval")

      expect(result.decision).toBe(ReviewDecision.OVERRIDE_APPROVE)
    })
  })

  describe("rejectReview", () => {
    it("should reject a review with high/critical risk", async () => {
      const highRiskReview = { ...mockReview, aiRiskLevel: RiskLevel.HIGH, comments: [] }
      mockReviewRepository.findOne.mockResolvedValue(highRiskReview)
      mockReviewRepository.save.mockResolvedValue({
        ...highRiskReview,
        status: ReviewStatus.COMPLETED,
        decision: ReviewDecision.REJECT,
      })
      mockDocumentService.updateStatus.mockResolvedValue(undefined)

      const result = await service.rejectReview(mockReview.id, mockReview.reviewerId, "Too risky")

      expect(result.status).toBe(ReviewStatus.COMPLETED)
      expect(result.decision).toBe(ReviewDecision.REJECT)
    })

    it("should override reject a review with low/medium risk", async () => {
      const reviewWithComments = { ...mockReview, comments: [] }
      mockReviewRepository.findOne.mockResolvedValue(reviewWithComments)
      mockReviewRepository.save.mockResolvedValue({
        ...reviewWithComments,
        status: ReviewStatus.COMPLETED,
        decision: ReviewDecision.OVERRIDE_REJECT,
      })
      mockDocumentService.updateStatus.mockResolvedValue(undefined)

      const result = await service.rejectReview(mockReview.id, mockReview.reviewerId, "Override rejection")

      expect(result.decision).toBe(ReviewDecision.OVERRIDE_REJECT)
    })
  })

  describe("escalateReview", () => {
    it("should escalate a review successfully", async () => {
      const reviewWithComments = { ...mockReview, comments: [] }
      mockReviewRepository.findOne.mockResolvedValue(reviewWithComments)
      mockReviewRepository.save.mockResolvedValue({
        ...reviewWithComments,
        status: ReviewStatus.ESCALATED,
        decision: ReviewDecision.ESCALATE,
        isEscalated: true,
      })
      mockDocumentService.updateStatus.mockResolvedValue(undefined)

      const result = await service.escalateReview(mockReview.id, mockReview.reviewerId, "Needs senior review")

      expect(result.status).toBe(ReviewStatus.ESCALATED)
      expect(result.decision).toBe(ReviewDecision.ESCALATE)
      expect(result.isEscalated).toBe(true)
    })
  })

  describe("getReviewStats", () => {
    it("should return review statistics", async () => {
      const mockQueryBuilder = mockReviewRepository.createQueryBuilder()
      mockQueryBuilder.getCount
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(3) // pending
        .mockResolvedValueOnce(2) // in progress
        .mockResolvedValueOnce(4) // completed
        .mockResolvedValueOnce(1) // escalated
        .mockResolvedValueOnce(3) // approved
        .mockResolvedValueOnce(1) // rejected

      const result = await service.getReviewStats()

      expect(result).toEqual({
        total: 10,
        byStatus: {
          pending: 3,
          inProgress: 2,
          completed: 4,
          escalated: 1,
        },
        byDecision: {
          approved: 3,
          rejected: 1,
        },
        completionRate: 40,
      })
    })

    it("should return stats for specific reviewer", async () => {
      const reviewerId = "123e4567-e89b-12d3-a456-426614174002"
      const mockQueryBuilder = mockReviewRepository.createQueryBuilder()
      mockQueryBuilder.getCount.mockResolvedValue(5)

      await service.getReviewStats(reviewerId)

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith("review.reviewerId = :reviewerId", { reviewerId })
    })
  })
})
