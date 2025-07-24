import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common"
import type { Repository, SelectQueryBuilder } from "typeorm"
import type { Review } from "../entities/review.entity"
import type { ReviewComment } from "../entities/review-comment.entity"
import type { CreateReviewDto } from "../dto/create-review.dto"
import type { UpdateReviewDto } from "../dto/update-review.dto"
import type { AddCommentDto } from "../dto/add-comment.dto"
import type { ReviewQueryDto } from "../dto/review-query.dto"
import { ReviewStatus, ReviewDecision } from "../enums/review.enums"
import type { DocumentService } from "../../document/services/document.service"

@Injectable()
export class ReviewService {
  constructor(
    private readonly reviewRepository: Repository<Review>,
    private readonly commentRepository: Repository<ReviewComment>,
    private readonly documentService: DocumentService,
  ) {}

  async createReview(createReviewDto: CreateReviewDto): Promise<Review> {
    // Validate document exists
    await this.documentService.findOne(createReviewDto.documentId)

    // Check if review already exists for this document
    const existingReview = await this.reviewRepository.findOne({
      where: { documentId: createReviewDto.documentId },
    })

    if (existingReview) {
      throw new BadRequestException("Review already exists for this document")
    }

    const review = this.reviewRepository.create({
      ...createReviewDto,
      status: ReviewStatus.PENDING,
      reviewMetadata: {
        createdBy: "system",
        source: "ai_detection",
        ...createReviewDto,
      },
    })

    return await this.reviewRepository.save(review)
  }

  async findAll(queryDto: ReviewQueryDto): Promise<{
    reviews: Review[]
    total: number
    page: number
    limit: number
  }> {
    const { page = 1, limit = 10, ...filters } = queryDto
    const skip = (page - 1) * limit

    const queryBuilder = this.createQueryBuilder(filters)

    const [reviews, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy("review.createdAt", "DESC")
      .getManyAndCount()

    return {
      reviews,
      total,
      page,
      limit,
    }
  }

  async findOne(id: string): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: ["comments", "comments.author"],
    })

    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`)
    }

    return review
  }

  async updateReview(id: string, updateReviewDto: UpdateReviewDto, reviewerId: string): Promise<Review> {
    const review = await this.findOne(id)

    // Validate reviewer permissions
    if (review.reviewerId !== reviewerId) {
      throw new ForbiddenException("You can only update your own reviews")
    }

    // Auto-set reviewed_at when completing review
    if (updateReviewDto.status === ReviewStatus.COMPLETED) {
      updateReviewDto["reviewedAt"] = new Date()
    }

    // Update review metadata
    const updatedMetadata = {
      ...review.reviewMetadata,
      lastUpdatedBy: reviewerId,
      lastUpdatedAt: new Date().toISOString(),
      ...updateReviewDto.reviewMetadata,
    }

    Object.assign(review, {
      ...updateReviewDto,
      reviewMetadata: updatedMetadata,
    })

    const updatedReview = await this.reviewRepository.save(review)

    // Update document status based on review decision
    if (updateReviewDto.decision) {
      await this.updateDocumentStatus(review.documentId, updateReviewDto.decision)
    }

    return updatedReview
  }

  async addComment(reviewId: string, addCommentDto: AddCommentDto, authorId: string): Promise<ReviewComment> {
    const review = await this.findOne(reviewId)

    const comment = this.commentRepository.create({
      ...addCommentDto,
      reviewId,
      authorId,
      metadata: {
        ...addCommentDto.metadata,
        createdBy: authorId,
        reviewStatus: review.status,
      },
    })

    return await this.commentRepository.save(comment)
  }

  async approveReview(id: string, reviewerId: string, notes?: string): Promise<Review> {
    const review = await this.findOne(id)

    if (review.reviewerId !== reviewerId) {
      throw new ForbiddenException("You can only approve your own reviews")
    }

    const updateDto: UpdateReviewDto = {
      status: ReviewStatus.COMPLETED,
      decision:
        review.aiRiskLevel === "low" || review.aiRiskLevel === "medium"
          ? ReviewDecision.APPROVE
          : ReviewDecision.OVERRIDE_APPROVE,
      reviewerNotes: notes,
    }

    return await this.updateReview(id, updateDto, reviewerId)
  }

  async rejectReview(id: string, reviewerId: string, notes: string): Promise<Review> {
    const review = await this.findOne(id)

    if (review.reviewerId !== reviewerId) {
      throw new ForbiddenException("You can only reject your own reviews")
    }

    const updateDto: UpdateReviewDto = {
      status: ReviewStatus.COMPLETED,
      decision:
        review.aiRiskLevel === "high" || review.aiRiskLevel === "critical"
          ? ReviewDecision.REJECT
          : ReviewDecision.OVERRIDE_REJECT,
      reviewerNotes: notes,
    }

    return await this.updateReview(id, updateDto, reviewerId)
  }

  async escalateReview(id: string, reviewerId: string, escalationReason: string): Promise<Review> {
    const review = await this.findOne(id)

    if (review.reviewerId !== reviewerId) {
      throw new ForbiddenException("You can only escalate your own reviews")
    }

    const updateDto: UpdateReviewDto = {
      status: ReviewStatus.ESCALATED,
      decision: ReviewDecision.ESCALATE,
      escalationReason,
      isEscalated: true,
    }

    return await this.updateReview(id, updateDto, reviewerId)
  }

  async getReviewStats(reviewerId?: string): Promise<any> {
    const queryBuilder = this.reviewRepository.createQueryBuilder("review")

    if (reviewerId) {
      queryBuilder.where("review.reviewerId = :reviewerId", { reviewerId })
    }

    const [total, pending, inProgress, completed, escalated, approved, rejected] = await Promise.all([
      queryBuilder.getCount(),
      queryBuilder.clone().andWhere("review.status = :status", { status: ReviewStatus.PENDING }).getCount(),
      queryBuilder.clone().andWhere("review.status = :status", { status: ReviewStatus.IN_PROGRESS }).getCount(),
      queryBuilder.clone().andWhere("review.status = :status", { status: ReviewStatus.COMPLETED }).getCount(),
      queryBuilder.clone().andWhere("review.status = :status", { status: ReviewStatus.ESCALATED }).getCount(),
      queryBuilder
        .clone()
        .andWhere("review.decision IN (:...decisions)", {
          decisions: [ReviewDecision.APPROVE, ReviewDecision.OVERRIDE_APPROVE],
        })
        .getCount(),
      queryBuilder
        .clone()
        .andWhere("review.decision IN (:...decisions)", {
          decisions: [ReviewDecision.REJECT, ReviewDecision.OVERRIDE_REJECT],
        })
        .getCount(),
    ])

    return {
      total,
      byStatus: {
        pending,
        inProgress,
        completed,
        escalated,
      },
      byDecision: {
        approved,
        rejected,
      },
      completionRate: total > 0 ? (completed / total) * 100 : 0,
    }
  }

  private createQueryBuilder(filters: Partial<ReviewQueryDto>): SelectQueryBuilder<Review> {
    const queryBuilder = this.reviewRepository
      .createQueryBuilder("review")
      .leftJoinAndSelect("review.reviewer", "reviewer")
      .leftJoinAndSelect("review.document", "document")

    if (filters.status) {
      queryBuilder.andWhere("review.status = :status", { status: filters.status })
    }

    if (filters.decision) {
      queryBuilder.andWhere("review.decision = :decision", { decision: filters.decision })
    }

    if (filters.aiRiskLevel) {
      queryBuilder.andWhere("review.aiRiskLevel = :aiRiskLevel", { aiRiskLevel: filters.aiRiskLevel })
    }

    if (filters.reviewerRiskLevel) {
      queryBuilder.andWhere("review.reviewerRiskLevel = :reviewerRiskLevel", {
        reviewerRiskLevel: filters.reviewerRiskLevel,
      })
    }

    if (filters.reviewerId) {
      queryBuilder.andWhere("review.reviewerId = :reviewerId", { reviewerId: filters.reviewerId })
    }

    if (filters.documentId) {
      queryBuilder.andWhere("review.documentId = :documentId", { documentId: filters.documentId })
    }

    if (filters.createdAfter) {
      queryBuilder.andWhere("review.createdAt >= :createdAfter", { createdAfter: filters.createdAfter })
    }

    if (filters.createdBefore) {
      queryBuilder.andWhere("review.createdAt <= :createdBefore", { createdBefore: filters.createdBefore })
    }

    if (filters.dueBefore) {
      queryBuilder.andWhere("review.dueDate <= :dueBefore", { dueBefore: filters.dueBefore })
    }

    return queryBuilder
  }

  private async updateDocumentStatus(documentId: string, decision: ReviewDecision): Promise<void> {
    let status: string

    switch (decision) {
      case ReviewDecision.APPROVE:
      case ReviewDecision.OVERRIDE_APPROVE:
        status = "approved"
        break
      case ReviewDecision.REJECT:
      case ReviewDecision.OVERRIDE_REJECT:
        status = "rejected"
        break
      case ReviewDecision.ESCALATE:
        status = "escalated"
        break
      default:
        return
    }

    await this.documentService.updateStatus(documentId, status)
  }
}
