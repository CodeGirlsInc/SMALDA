import { Injectable, NotFoundException } from "@nestjs/common"
import { type Repository, IsNull } from "typeorm"
import type { Feedback } from "./entities/feedback.entity"
import type { FeedbackComment } from "./entities/feedback-comment.entity" // Import new entity
import type { CreateFeedbackDto } from "./dto/create-feedback.dto"
import type { UpdateFeedbackDto } from "./dto/update-feedback.dto"
import type { FilterFeedbackDto } from "./dto/filter-feedback.dto"
import type { CreateFeedbackCommentDto } from "./dto/create-feedback-comment.dto"
import type { UpdateFeedbackCommentDto } from "./dto/update-feedback-comment.dto"
import { FeedbackStatus } from "./enums/feedback-status.enum"

@Injectable()
export class FeedbackService {
  private feedbackRepository: Repository<Feedback>
  private feedbackCommentRepository: Repository<FeedbackComment>

  constructor(feedbackRepository: Repository<Feedback>, feedbackCommentRepository: Repository<FeedbackComment>) {
    this.feedbackRepository = feedbackRepository
    this.feedbackCommentRepository = feedbackCommentRepository
  }

  /**
   * Creates a new feedback entry.
   * @param createFeedbackDto The DTO containing feedback data.
   * @returns The created feedback entity.
   */
  async create(createFeedbackDto: CreateFeedbackDto): Promise<Feedback> {
    const feedback = this.feedbackRepository.create(createFeedbackDto)
    return this.feedbackRepository.save(feedback)
  }

  /**
   * Retrieves all feedback entries with optional filtering, pagination, and sorting.
   * Includes comments by default.
   * @param filterDto The DTO containing filter, pagination, and sort parameters.
   * @returns An object containing feedback entries and total count.
   */
  async findAll(filterDto: FilterFeedbackDto): Promise<{ data: Feedback[]; total: number }> {
    const {
      feedbackType,
      status,
      priority,
      severity, // New filter
      source, // New filter
      userId,
      assignedTo, // New filter
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "DESC",
      search,
    } = filterDto

    const queryBuilder = this.feedbackRepository.createQueryBuilder("feedback")

    queryBuilder.where("feedback.deletedAt IS NULL") // Only retrieve non-deleted feedback

    // Apply filters
    if (feedbackType) {
      queryBuilder.andWhere("feedback.feedbackType = :feedbackType", { feedbackType })
    }
    if (status) {
      queryBuilder.andWhere("feedback.status = :status", { status })
    }
    if (priority) {
      queryBuilder.andWhere("feedback.priority = :priority", { priority })
    }
    if (severity) {
      // New filter
      queryBuilder.andWhere("feedback.severity = :severity", { severity })
    }
    if (source) {
      // New filter
      queryBuilder.andWhere("feedback.source = :source", { source })
    }
    if (userId) {
      queryBuilder.andWhere("feedback.userId = :userId", { userId })
    }
    if (assignedTo) {
      // New filter
      queryBuilder.andWhere("feedback.assignedTo = :assignedTo", { assignedTo })
    }
    if (startDate) {
      queryBuilder.andWhere("feedback.createdAt >= :startDate", { startDate: new Date(startDate) })
    }
    if (endDate) {
      queryBuilder.andWhere("feedback.createdAt <= :endDate", { endDate: new Date(endDate) })
    }
    if (search) {
      queryBuilder.andWhere("(feedback.subject ILIKE :search OR feedback.message ILIKE :search)", {
        search: `%${search}%`,
      })
    }

    // Add relations for comments
    queryBuilder.leftJoinAndSelect("feedback.comments", "comments")

    // Order by
    queryBuilder.orderBy(`feedback.${sortBy}`, sortOrder)

    // Pagination
    queryBuilder.skip((page - 1) * limit).take(limit)

    const [data, total] = await queryBuilder.getManyAndCount()
    return { data, total }
  }

  /**
   * Retrieves a single feedback entry by its ID.
   * Includes comments.
   * @param id The UUID of the feedback entry.
   * @returns The feedback entity or undefined if not found.
   */
  async findOne(id: string): Promise<Feedback | undefined> {
    return this.feedbackRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ["comments"], // Eager load comments
      order: {
        comments: {
          createdAt: "ASC", // Order comments by creation date
        },
      },
    })
  }

  /**
   * Updates an existing feedback entry.
   * @param id The UUID of the feedback entry.
   * @param updateFeedbackDto The DTO containing updated feedback data.
   * @returns The updated feedback entity or undefined if not found.
   */
  async update(id: string, updateFeedbackDto: UpdateFeedbackDto): Promise<Feedback | undefined> {
    const feedback = await this.findOne(id)
    if (!feedback) {
      return undefined
    }

    // Update fields
    Object.assign(feedback, updateFeedbackDto)

    // Handle resolvedAt if status is set to resolved and it's not already set
    if (updateFeedbackDto.status === FeedbackStatus.RESOLVED && !feedback.resolvedAt) {
      feedback.resolvedAt = new Date()
    } else if (updateFeedbackDto.status !== FeedbackStatus.RESOLVED && feedback.resolvedAt) {
      // If status changes from resolved, clear resolvedAt and resolvedBy
      feedback.resolvedAt = null
      feedback.resolvedBy = null
      feedback.resolutionNotes = null // Clear resolution notes if status changes from resolved
    }

    return this.feedbackRepository.save(feedback)
  }

  /**
   * Marks a feedback entry as resolved.
   * @param id The UUID of the feedback entry.
   * @param resolvedBy The ID of the user who resolved the feedback.
   * @param resolutionNotes Optional notes on how the feedback was resolved.
   * @returns The resolved feedback entity or undefined if not found.
   */
  async resolve(id: string, resolvedBy: string, resolutionNotes?: string): Promise<Feedback | undefined> {
    const feedback = await this.findOne(id)
    if (!feedback) {
      return undefined
    }
    feedback.status = FeedbackStatus.RESOLVED
    feedback.resolvedAt = new Date()
    feedback.resolvedBy = resolvedBy
    feedback.resolutionNotes = resolutionNotes || feedback.resolutionNotes // Update notes if provided
    return this.feedbackRepository.save(feedback)
  }

  /**
   * Assigns a feedback entry to a specific user.
   * @param id The UUID of the feedback entry.
   * @param assignedTo The ID of the user to assign the feedback to.
   * @returns The updated feedback entity or undefined if not found.
   */
  async assignFeedback(id: string, assignedTo: string): Promise<Feedback | undefined> {
    const feedback = await this.findOne(id)
    if (!feedback) {
      return undefined
    }
    feedback.assignedTo = assignedTo
    return this.feedbackRepository.save(feedback)
  }

  /**
   * Unassigns a feedback entry from any user.
   * @param id The UUID of the feedback entry.
   * @returns The updated feedback entity or undefined if not found.
   */
  async unassignFeedback(id: string): Promise<Feedback | undefined> {
    const feedback = await this.findOne(id)
    if (!feedback) {
      return undefined
    }
    feedback.assignedTo = null
    return this.feedbackRepository.save(feedback)
  }

  /**
   * Soft deletes a feedback entry.
   * @param id The UUID of the feedback entry.
   * @returns True if deleted, false if not found.
   */
  async remove(id: string): Promise<boolean> {
    const result = await this.feedbackRepository.softDelete(id)
    return result.affected > 0
  }

  // --- Feedback Comment Methods ---

  /**
   * Adds a new comment to a specific feedback entry.
   * @param feedbackId The UUID of the feedback entry.
   * @param createCommentDto The DTO containing comment data.
   * @returns The created comment entity.
   */
  async createComment(feedbackId: string, createCommentDto: CreateFeedbackCommentDto): Promise<FeedbackComment> {
    const feedback = await this.feedbackRepository.findOne({ where: { id: feedbackId, deletedAt: IsNull() } })
    if (!feedback) {
      throw new NotFoundException(`Feedback with ID "${feedbackId}" not found.`)
    }
    const comment = this.feedbackCommentRepository.create({
      ...createCommentDto,
      feedback, // Link the comment to the feedback entity
    })
    return this.feedbackCommentRepository.save(comment)
  }

  /**
   * Retrieves all comments for a specific feedback entry.
   * @param feedbackId The UUID of the feedback entry.
   * @returns An array of comment entities.
   */
  async findCommentsByFeedbackId(feedbackId: string): Promise<FeedbackComment[]> {
    return this.feedbackCommentRepository.find({
      where: { feedback: { id: feedbackId } },
      order: { createdAt: "ASC" },
    })
  }

  /**
   * Updates an existing comment.
   * @param feedbackId The UUID of the parent feedback entry.
   * @param commentId The UUID of the comment to update.
   * @param updateCommentDto The DTO containing updated comment data.
   * @returns The updated comment entity or undefined if not found.
   */
  async updateComment(
    feedbackId: string,
    commentId: string,
    updateCommentDto: UpdateFeedbackCommentDto,
  ): Promise<FeedbackComment | undefined> {
    const comment = await this.feedbackCommentRepository.findOne({
      where: { id: commentId, feedback: { id: feedbackId } },
    })
    if (!comment) {
      return undefined
    }
    Object.assign(comment, updateCommentDto)
    return this.feedbackCommentRepository.save(comment)
  }

  /**
   * Deletes a specific comment.
   * @param feedbackId The UUID of the parent feedback entry.
   * @param commentId The UUID of the comment to delete.
   * @returns True if deleted, false if not found.
   */
  async removeComment(feedbackId: string, commentId: string): Promise<boolean> {
    const result = await this.feedbackCommentRepository.delete({ id: commentId, feedback: { id: feedbackId } })
    return result.affected > 0
  }
}
