import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from "@nestjs/common"
import { type Repository, IsNull, Between, type FindOptionsWhere } from "typeorm"
import type { DocumentComment } from "./entities/document-comment.entity"
import type { CreateCommentDto } from "./dto/create-comment.dto"
import type { UpdateCommentDto } from "./dto/update-comment.dto"
import type { FilterCommentsDto } from "./dto/filter-comments.dto"
import type { CommentResponseDto, PaginatedCommentsDto } from "./dto/comment-response.dto"

@Injectable()
export class DocumentCommentsService {
  private readonly logger = new Logger(DocumentCommentsService.name)

  constructor(private readonly commentRepository: Repository<DocumentComment>) {}

  async create(createCommentDto: CreateCommentDto): Promise<CommentResponseDto> {
    try {
      // Validate parent comment exists if provided
      if (createCommentDto.parentCommentId) {
        const parentComment = await this.commentRepository.findOne({
          where: {
            id: createCommentDto.parentCommentId,
            documentId: createCommentDto.documentId,
            isDeleted: false,
          },
        })

        if (!parentComment) {
          throw new BadRequestException("Parent comment not found or belongs to different document")
        }
      }

      const comment = this.commentRepository.create(createCommentDto)
      const savedComment = await this.commentRepository.save(comment)

      return this.mapToResponseDto(savedComment)
    } catch (error) {
      this.logger.error("Failed to create comment", error.stack)
      throw error
    }
  }

  async findAllByDocument(filterDto: FilterCommentsDto): Promise<PaginatedCommentsDto> {
    const {
      documentId,
      page = 1,
      limit = 50,
      sortByDateDesc = false,
      includeDeleted = false,
      threaded = true,
      ...filters
    } = filterDto

    const where: FindOptionsWhere<DocumentComment> = {
      documentId,
      isDeleted: includeDeleted ? undefined : false,
    }

    // Apply additional filters
    if (filters.authorId) {
      where.authorId = filters.authorId
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      const startDate = filters.startDate ? new Date(filters.startDate) : new Date("1970-01-01")
      const endDate = filters.endDate ? new Date(filters.endDate) : new Date()
      where.createdAt = Between(startDate, endDate)
    }

    if (threaded) {
      // For threaded view, only get top-level comments
      where.parentCommentId = IsNull()
    }

    const [comments, total] = await this.commentRepository.findAndCount({
      where,
      relations: threaded ? ["replies", "replies.replies"] : [],
      order: {
        createdAt: sortByDateDesc ? "DESC" : "ASC",
        ...(threaded && {
          replies: {
            createdAt: "ASC",
            replies: {
              createdAt: "ASC",
            },
          },
        }),
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    const data = await Promise.all(
      comments.map(async (comment) => {
        const dto = this.mapToResponseDto(comment)
        if (threaded && comment.replies) {
          dto.replies = comment.replies
            .filter((reply) => includeDeleted || !reply.isDeleted)
            .map((reply) => ({
              ...this.mapToResponseDto(reply),
              replies: reply.replies
                ?.filter((nestedReply) => includeDeleted || !nestedReply.isDeleted)
                .map((nestedReply) => this.mapToResponseDto(nestedReply)),
            }))
        }
        dto.replyCount = await this.getReplyCount(comment.id, includeDeleted)
        return dto
      }),
    )

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async findOne(id: string, includeDeleted = false): Promise<CommentResponseDto> {
    const comment = await this.commentRepository.findOne({
      where: {
        id,
        ...(includeDeleted ? {} : { isDeleted: false }),
      },
      relations: ["replies", "parentComment"],
    })

    if (!comment) {
      throw new NotFoundException("Comment not found")
    }

    const dto = this.mapToResponseDto(comment)
    dto.replyCount = await this.getReplyCount(comment.id, includeDeleted)

    if (comment.replies) {
      dto.replies = comment.replies
        .filter((reply) => includeDeleted || !reply.isDeleted)
        .map((reply) => this.mapToResponseDto(reply))
    }

    return dto
  }

  async update(id: string, updateCommentDto: UpdateCommentDto, userId: string): Promise<CommentResponseDto> {
    const comment = await this.commentRepository.findOne({
      where: { id, isDeleted: false },
    })

    if (!comment) {
      throw new NotFoundException("Comment not found")
    }

    // Check if user is the author
    if (comment.authorId !== userId) {
      throw new ForbiddenException("You can only edit your own comments")
    }

    // Update the comment
    Object.assign(comment, updateCommentDto)
    comment.isEdited = true
    comment.updatedAt = new Date()

    const updatedComment = await this.commentRepository.save(comment)
    return this.mapToResponseDto(updatedComment)
  }

  async remove(id: string, userId: string, hardDelete = false): Promise<void> {
    const comment = await this.commentRepository.findOne({
      where: { id, isDeleted: false },
      relations: ["replies"],
    })

    if (!comment) {
      throw new NotFoundException("Comment not found")
    }

    // Check if user is the author
    if (comment.authorId !== userId) {
      throw new ForbiddenException("You can only delete your own comments")
    }

    if (hardDelete) {
      // Hard delete - remove from database
      await this.commentRepository.remove(comment)
    } else {
      // Soft delete - mark as deleted
      comment.isDeleted = true
      comment.deletedAt = new Date()
      comment.content = "[Comment deleted]"
      await this.commentRepository.save(comment)
    }
  }

  async getCommentStats(documentId: string): Promise<{
    totalComments: number
    totalReplies: number
    uniqueAuthors: number
    recentActivity: Date | null
  }> {
    const queryBuilder = this.commentRepository
      .createQueryBuilder("comment")
      .where("comment.documentId = :documentId", { documentId })
      .andWhere("comment.isDeleted = false")

    const totalComments = await queryBuilder.getCount()

    const totalReplies = await queryBuilder.andWhere("comment.parentCommentId IS NOT NULL").getCount()

    const uniqueAuthorsResult = await this.commentRepository
      .createQueryBuilder("comment")
      .select("COUNT(DISTINCT comment.authorId)", "count")
      .where("comment.documentId = :documentId", { documentId })
      .andWhere("comment.isDeleted = false")
      .getRawOne()

    const recentActivityResult = await this.commentRepository
      .createQueryBuilder("comment")
      .select("MAX(comment.updatedAt)", "lastActivity")
      .where("comment.documentId = :documentId", { documentId })
      .andWhere("comment.isDeleted = false")
      .getRawOne()

    return {
      totalComments: totalComments - totalReplies, // Top-level comments only
      totalReplies,
      uniqueAuthors: Number.parseInt(uniqueAuthorsResult.count),
      recentActivity: recentActivityResult.lastActivity ? new Date(recentActivityResult.lastActivity) : null,
    }
  }

  async getCommentsByAuthor(authorId: string, limit = 100): Promise<CommentResponseDto[]> {
    const comments = await this.commentRepository.find({
      where: { authorId, isDeleted: false },
      order: { createdAt: "DESC" },
      take: limit,
    })

    return comments.map((comment) => this.mapToResponseDto(comment))
  }

  private async getReplyCount(commentId: string, includeDeleted = false): Promise<number> {
    return this.commentRepository.count({
      where: {
        parentCommentId: commentId,
        ...(includeDeleted ? {} : { isDeleted: false }),
      },
    })
  }

  private mapToResponseDto(comment: DocumentComment): CommentResponseDto {
    return {
      id: comment.id,
      documentId: comment.documentId,
      authorId: comment.authorId,
      authorName: comment.authorName,
      authorEmail: comment.authorEmail,
      content: comment.content,
      parentCommentId: comment.parentCommentId,
      isEdited: comment.isEdited,
      isDeleted: comment.isDeleted,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    }
  }
}
