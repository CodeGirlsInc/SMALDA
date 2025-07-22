import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { DocumentCommentsService } from "../document-comments.service"
import { DocumentComment } from "../entities/document-comment.entity"
import type { CreateCommentDto } from "../dto/create-comment.dto"
import type { UpdateCommentDto } from "../dto/update-comment.dto"
import type { FilterCommentsDto } from "../dto/filter-comments.dto"
import { NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common"
import { jest } from "@jest/globals"

describe("DocumentCommentsService", () => {
  let service: DocumentCommentsService
  let repository: Repository<DocumentComment>

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const mockComment: DocumentComment = {
    id: "comment-123",
    documentId: "doc-123",
    authorId: "user-123",
    authorName: "John Doe",
    authorEmail: "john@example.com",
    content: "This is a test comment",
    parentCommentId: null,
    parentComment: null,
    replies: [],
    isEdited: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentCommentsService,
        {
          provide: getRepositoryToken(DocumentComment),
          useValue: mockRepository,
        },
      ],
    }).compile()

    service = module.get<DocumentCommentsService>(DocumentCommentsService)
    repository = module.get<Repository<DocumentComment>>(getRepositoryToken(DocumentComment))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("create", () => {
    it("should create a top-level comment", async () => {
      const createDto: CreateCommentDto = {
        documentId: "doc-123",
        authorId: "user-123",
        authorName: "John Doe",
        authorEmail: "john@example.com",
        content: "This is a test comment",
      }

      mockRepository.create.mockReturnValue(mockComment)
      mockRepository.save.mockResolvedValue(mockComment)

      const result = await service.create(createDto)

      expect(mockRepository.create).toHaveBeenCalledWith(createDto)
      expect(mockRepository.save).toHaveBeenCalledWith(mockComment)
      expect(result.id).toBe(mockComment.id)
      expect(result.content).toBe(mockComment.content)
    })

    it("should create a reply comment", async () => {
      const parentComment = { ...mockComment, id: "parent-123" }
      const replyComment = {
        ...mockComment,
        id: "reply-123",
        parentCommentId: "parent-123",
        content: "This is a reply",
      }

      const createDto: CreateCommentDto = {
        documentId: "doc-123",
        authorId: "user-123",
        authorName: "John Doe",
        authorEmail: "john@example.com",
        content: "This is a reply",
        parentCommentId: "parent-123",
      }

      mockRepository.findOne.mockResolvedValue(parentComment)
      mockRepository.create.mockReturnValue(replyComment)
      mockRepository.save.mockResolvedValue(replyComment)

      const result = await service.create(createDto)

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: "parent-123",
          documentId: "doc-123",
          isDeleted: false,
        },
      })
      expect(result.parentCommentId).toBe("parent-123")
    })

    it("should throw BadRequestException for invalid parent comment", async () => {
      const createDto: CreateCommentDto = {
        documentId: "doc-123",
        authorId: "user-123",
        authorName: "John Doe",
        authorEmail: "john@example.com",
        content: "This is a reply",
        parentCommentId: "invalid-parent",
      }

      mockRepository.findOne.mockResolvedValue(null)

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException)
    })
  })

  describe("findAllByDocument", () => {
    it("should return paginated comments for a document", async () => {
      const filterDto: FilterCommentsDto = {
        documentId: "doc-123",
        page: 1,
        limit: 10,
        threaded: true,
      }

      const mockComments = [mockComment]
      mockRepository.findAndCount.mockResolvedValue([mockComments, 1])
      mockRepository.count.mockResolvedValue(0) // No replies

      const result = await service.findAllByDocument(filterDto)

      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(result.totalPages).toBe(1)
    })

    it("should filter comments by author", async () => {
      const filterDto: FilterCommentsDto = {
        documentId: "doc-123",
        authorId: "user-123",
        page: 1,
        limit: 10,
      }

      mockRepository.findAndCount.mockResolvedValue([[mockComment], 1])
      mockRepository.count.mockResolvedValue(0)

      await service.findAllByDocument(filterDto)

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            documentId: "doc-123",
            authorId: "user-123",
            isDeleted: false,
          }),
        }),
      )
    })
  })

  describe("findOne", () => {
    it("should return a comment by ID", async () => {
      mockRepository.findOne.mockResolvedValue(mockComment)
      mockRepository.count.mockResolvedValue(2) // 2 replies

      const result = await service.findOne("comment-123")

      expect(result.id).toBe("comment-123")
      expect(result.replyCount).toBe(2)
    })

    it("should throw NotFoundException for non-existent comment", async () => {
      mockRepository.findOne.mockResolvedValue(null)

      await expect(service.findOne("non-existent")).rejects.toThrow(NotFoundException)
    })
  })

  describe("update", () => {
    it("should update a comment", async () => {
      const updateDto: UpdateCommentDto = {
        content: "Updated content",
      }

      const updatedComment = { ...mockComment, content: "Updated content", isEdited: true }

      mockRepository.findOne.mockResolvedValue(mockComment)
      mockRepository.save.mockResolvedValue(updatedComment)

      const result = await service.update("comment-123", updateDto, "user-123")

      expect(result.content).toBe("Updated content")
      expect(result.isEdited).toBe(true)
    })

    it("should throw ForbiddenException when user is not the author", async () => {
      const updateDto: UpdateCommentDto = {
        content: "Updated content",
      }

      mockRepository.findOne.mockResolvedValue(mockComment)

      await expect(service.update("comment-123", updateDto, "different-user")).rejects.toThrow(ForbiddenException)
    })

    it("should throw NotFoundException for non-existent comment", async () => {
      const updateDto: UpdateCommentDto = {
        content: "Updated content",
      }

      mockRepository.findOne.mockResolvedValue(null)

      await expect(service.update("non-existent", updateDto, "user-123")).rejects.toThrow(NotFoundException)
    })
  })

  describe("remove", () => {
    it("should soft delete a comment", async () => {
      const commentWithReplies = { ...mockComment, replies: [] }
      mockRepository.findOne.mockResolvedValue(commentWithReplies)
      mockRepository.save.mockResolvedValue({ ...commentWithReplies, isDeleted: true })

      await service.remove("comment-123", "user-123", false)

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isDeleted: true,
          content: "[Comment deleted]",
        }),
      )
    })

    it("should hard delete a comment", async () => {
      const commentWithReplies = { ...mockComment, replies: [] }
      mockRepository.findOne.mockResolvedValue(commentWithReplies)

      await service.remove("comment-123", "user-123", true)

      expect(mockRepository.remove).toHaveBeenCalledWith(commentWithReplies)
    })

    it("should throw ForbiddenException when user is not the author", async () => {
      mockRepository.findOne.mockResolvedValue(mockComment)

      await expect(service.remove("comment-123", "different-user")).rejects.toThrow(ForbiddenException)
    })
  })

  describe("getCommentStats", () => {
    it("should return comment statistics", async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(10),
        getRawOne: jest.fn(),
      }

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)

      // Mock different return values for different queries
      mockQueryBuilder.getCount
        .mockResolvedValueOnce(15) // Total comments
        .mockResolvedValueOnce(5) // Total replies

      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({ count: "3" }) // Unique authors
        .mockResolvedValueOnce({ lastActivity: "2023-01-01T00:00:00Z" }) // Recent activity

      const result = await service.getCommentStats("doc-123")

      expect(result).toEqual({
        totalComments: 10, // 15 - 5 replies
        totalReplies: 5,
        uniqueAuthors: 3,
        recentActivity: new Date("2023-01-01T00:00:00Z"),
      })
    })
  })

  describe("getCommentsByAuthor", () => {
    it("should return comments by author", async () => {
      const authorComments = [mockComment]
      mockRepository.find.mockResolvedValue(authorComments)

      const result = await service.getCommentsByAuthor("user-123", 50)

      expect(result).toHaveLength(1)
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { authorId: "user-123", isDeleted: false },
        order: { createdAt: "DESC" },
        take: 50,
      })
    })
  })
})
