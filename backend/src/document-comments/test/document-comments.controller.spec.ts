import { Test, type TestingModule } from "@nestjs/testing"
import { DocumentCommentsController } from "../document-comments.controller"
import { DocumentCommentsService } from "../document-comments.service"
import type { CreateCommentDto } from "../dto/create-comment.dto"
import type { UpdateCommentDto } from "../dto/update-comment.dto"
import type { CommentResponseDto } from "../dto/comment-response.dto"
import { jest } from "@jest/globals"

describe("DocumentCommentsController", () => {
  let controller: DocumentCommentsController
  let service: DocumentCommentsService

  const mockComment: CommentResponseDto = {
    id: "comment-123",
    documentId: "doc-123",
    authorId: "user-123",
    authorName: "John Doe",
    authorEmail: "john@example.com",
    content: "This is a test comment",
    parentCommentId: null,
    isEdited: false,
    isDeleted: false,
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
  }

  const mockService = {
    create: jest.fn(),
    findAllByDocument: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getCommentStats: jest.fn(),
    getCommentsByAuthor: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentCommentsController],
      providers: [
        {
          provide: DocumentCommentsService,
          useValue: mockService,
        },
      ],
    }).compile()

    controller = module.get<DocumentCommentsController>(DocumentCommentsController)
    service = module.get<DocumentCommentsService>(DocumentCommentsService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("create", () => {
    it("should create a comment", async () => {
      const createDto: CreateCommentDto = {
        documentId: "doc-123",
        authorId: "user-123",
        authorName: "John Doe",
        authorEmail: "john@example.com",
        content: "This is a test comment",
      }

      mockService.create.mockResolvedValue(mockComment)

      const result = await controller.create(createDto)

      expect(result).toEqual(mockComment)
      expect(service.create).toHaveBeenCalledWith(createDto)
    })
  })

  describe("findAllByDocument", () => {
    it("should return paginated comments for a document", async () => {
      const documentId = "doc-123"
      const filterDto = { page: 1, limit: 10 }
      const expectedResult = {
        data: [mockComment],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }

      mockService.findAllByDocument.mockResolvedValue(expectedResult)

      const result = await controller.findAllByDocument(documentId, filterDto)

      expect(result).toEqual(expectedResult)
      expect(service.findAllByDocument).toHaveBeenCalledWith({ ...filterDto, documentId })
    })
  })

  describe("getDocumentStats", () => {
    it("should return document comment statistics", async () => {
      const documentId = "doc-123"
      const expectedStats = {
        totalComments: 10,
        totalReplies: 5,
        uniqueAuthors: 3,
        recentActivity: new Date("2023-01-01"),
      }

      mockService.getCommentStats.mockResolvedValue(expectedStats)

      const result = await controller.getDocumentStats(documentId)

      expect(result).toEqual(expectedStats)
      expect(service.getCommentStats).toHaveBeenCalledWith(documentId)
    })
  })

  describe("findByAuthor", () => {
    it("should return comments by author", async () => {
      const authorId = "user-123"
      const limit = 50

      mockService.getCommentsByAuthor.mockResolvedValue([mockComment])

      const result = await controller.findByAuthor(authorId, limit)

      expect(result).toEqual([mockComment])
      expect(service.getCommentsByAuthor).toHaveBeenCalledWith(authorId, limit)
    })
  })

  describe("findOne", () => {
    it("should return a comment by ID", async () => {
      const commentId = "comment-123"

      mockService.findOne.mockResolvedValue(mockComment)

      const result = await controller.findOne(commentId, false)

      expect(result).toEqual(mockComment)
      expect(service.findOne).toHaveBeenCalledWith(commentId, false)
    })
  })

  describe("update", () => {
    it("should update a comment", async () => {
      const commentId = "comment-123"
      const updateDto: UpdateCommentDto = {
        content: "Updated content",
      }
      const mockRequest = { user: { id: "user-123" } }
      const updatedComment = { ...mockComment, content: "Updated content", isEdited: true }

      mockService.update.mockResolvedValue(updatedComment)

      const result = await controller.update(commentId, updateDto, mockRequest)

      expect(result).toEqual(updatedComment)
      expect(service.update).toHaveBeenCalledWith(commentId, updateDto, "user-123")
    })
  })

  describe("remove", () => {
    it("should delete a comment", async () => {
      const commentId = "comment-123"
      const mockRequest = { user: { id: "user-123" } }

      mockService.remove.mockResolvedValue(undefined)

      await controller.remove(commentId, false, mockRequest)

      expect(service.remove).toHaveBeenCalledWith(commentId, "user-123", false)
    })
  })
})
