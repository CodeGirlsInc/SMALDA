import { Test, type TestingModule } from "@nestjs/testing"
import { ReviewController } from "./controllers/review.controller"
import { ReviewService } from "./services/review.service"
import type { CreateReviewDto } from "./dto/create-review.dto"
import type { UpdateReviewDto } from "./dto/update-review.dto"
import type { AddCommentDto } from "./dto/add-comment.dto"
import type { ReviewQueryDto } from "./dto/review-query.dto"
import { ReviewStatus, ReviewDecision, RiskLevel, CommentType } from "./enums/review.enums"
import { BadRequestException } from "@nestjs/common"
import { jest } from "@jest/globals" // Import jest to declare it

describe("ReviewController", () => {
  let controller: ReviewController
  let service: ReviewService

  const mockReview = {
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

  const mockComment = {
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

  const mockReviewService = {
    createReview: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateReview: jest.fn(),
    addComment: jest.fn(),
    approveReview: jest.fn(),
    rejectReview: jest.fn(),
    escalateReview: jest.fn(),
    getReviewStats: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewController],
      providers: [
        {
          provide: ReviewService,
          useValue: mockReviewService,
        },
      ],
    }).compile()

    controller = module.get<ReviewController>(ReviewController)
    service = module.get<ReviewService>(ReviewService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("createReview", () => {
    it("should create a review", async () => {
      const createReviewDto: CreateReviewDto = {
        documentId: "123e4567-e89b-12d3-a456-426614174001",
        reviewerId: "123e4567-e89b-12d3-a456-426614174002",
        aiRiskLevel: RiskLevel.MEDIUM,
        aiConfidenceScore: 0.75,
        aiDetectionDetails: { reason: "suspicious content" },
      }

      mockReviewService.createReview.mockResolvedValue(mockReview)

      const result = await controller.createReview(createReviewDto)

      expect(service.createReview).toHaveBeenCalledWith(createReviewDto)
      expect(result).toEqual(mockReview)
    })
  })

  describe("findAll", () => {
    it("should return paginated reviews", async () => {
      const queryDto: ReviewQueryDto = {
        page: 1,
        limit: 10,
        status: ReviewStatus.PENDING,
      }

      const mockResponse = {
        reviews: [mockReview],
        total: 1,
        page: 1,
        limit: 10,
      }

      mockReviewService.findAll.mockResolvedValue(mockResponse)

      const result = await controller.findAll(queryDto)

      expect(service.findAll).toHaveBeenCalledWith(queryDto)
      expect(result).toEqual(mockResponse)
    })
  })

  describe("findOne", () => {
    it("should return a review by id", async () => {
      mockReviewService.findOne.mockResolvedValue(mockReview)

      const result = await controller.findOne(mockReview.id)

      expect(service.findOne).toHaveBeenCalledWith(mockReview.id)
      expect(result).toEqual(mockReview)
    })
  })

  describe("updateReview", () => {
    it("should update a review", async () => {
      const updateReviewDto: UpdateReviewDto = {
        status: ReviewStatus.COMPLETED,
        decision: ReviewDecision.APPROVE,
      }

      const mockRequest = {
        user: { id: mockReview.reviewerId },
      }

      const updatedReview = { ...mockReview, ...updateReviewDto }
      mockReviewService.updateReview.mockResolvedValue(updatedReview)

      const result = await controller.updateReview(mockReview.id, updateReviewDto, mockRequest)

      expect(service.updateReview).toHaveBeenCalledWith(mockReview.id, updateReviewDto, mockRequest.user.id)
      expect(result).toEqual(updatedReview)
    })
  })

  describe("addComment", () => {
    it("should add a comment to a review", async () => {
      const addCommentDto: AddCommentDto = {
        content: "Test comment",
        type: CommentType.GENERAL,
      }

      const mockRequest = {
        user: { id: mockComment.authorId },
      }

      mockReviewService.addComment.mockResolvedValue(mockComment)

      const result = await controller.addComment(mockReview.id, addCommentDto, mockRequest)

      expect(service.addComment).toHaveBeenCalledWith(mockReview.id, addCommentDto, mockRequest.user.id)
      expect(result).toEqual(mockComment)
    })
  })

  describe("approveReview", () => {
    it("should approve a review", async () => {
      const notes = "Looks good to me"
      const mockRequest = {
        user: { id: mockReview.reviewerId },
      }

      const approvedReview = {
        ...mockReview,
        status: ReviewStatus.COMPLETED,
        decision: ReviewDecision.APPROVE,
      }

      mockReviewService.approveReview.mockResolvedValue(approvedReview)

      const result = await controller.approveReview(mockReview.id, notes, mockRequest)

      expect(service.approveReview).toHaveBeenCalledWith(mockReview.id, mockRequest.user.id, notes)
      expect(result).toEqual(approvedReview)
    })
  })

  describe("rejectReview", () => {
    it("should reject a review with notes", async () => {
      const notes = "Too risky to approve"
      const mockRequest = {
        user: { id: mockReview.reviewerId },
      }

      const rejectedReview = {
        ...mockReview,
        status: ReviewStatus.COMPLETED,
        decision: ReviewDecision.REJECT,
      }

      mockReviewService.rejectReview.mockResolvedValue(rejectedReview)

      const result = await controller.rejectReview(mockReview.id, notes, mockRequest)

      expect(service.rejectReview).toHaveBeenCalledWith(mockReview.id, mockRequest.user.id, notes)
      expect(result).toEqual(rejectedReview)
    })

    it("should throw BadRequestException if notes are missing", async () => {
      const mockRequest = {
        user: { id: mockReview.reviewerId },
      }

      await expect(controller.rejectReview(mockReview.id, "", mockRequest)).rejects.toThrow(BadRequestException)
    })
  })

  describe("escalateReview", () => {
    it("should escalate a review", async () => {
      const escalationReason = "Needs senior review"
      const mockRequest = {
        user: { id: mockReview.reviewerId },
      }

      const escalatedReview = {
        ...mockReview,
        status: ReviewStatus.ESCALATED,
        decision: ReviewDecision.ESCALATE,
        isEscalated: true,
      }

      mockReviewService.escalateReview.mockResolvedValue(escalatedReview)

      const result = await controller.escalateReview(mockReview.id, escalationReason, mockRequest)

      expect(service.escalateReview).toHaveBeenCalledWith(mockReview.id, mockRequest.user.id, escalationReason)
      expect(result).toEqual(escalatedReview)
    })

    it("should throw BadRequestException if escalation reason is missing", async () => {
      const mockRequest = {
        user: { id: mockReview.reviewerId },
      }

      await expect(controller.escalateReview(mockReview.id, "", mockRequest)).rejects.toThrow(BadRequestException)
    })
  })

  describe("getStats", () => {
    it("should return review statistics", async () => {
      const mockRequest = {
        user: { id: mockReview.reviewerId, role: "reviewer" },
      }

      const mockStats = {
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
      }

      mockReviewService.getReviewStats.mockResolvedValue(mockStats)

      const result = await controller.getStats(mockRequest)

      expect(service.getReviewStats).toHaveBeenCalledWith(mockRequest.user.id)
      expect(result).toEqual(mockStats)
    })
  })
})
