import { Injectable, NotFoundException } from "@nestjs/common"
import type { Repository } from "typeorm"
import { type HumanReview, ReviewStatus, type ReviewDecision } from "../entities/human-review.entity"
import type { CreateHumanReviewDto } from "../dto/create-human-review.dto"

@Injectable()
export class HumanReviewsService {
  constructor(private humanReviewRepository: Repository<HumanReview>) {}

  async create(datasetRecordId: string, createHumanReviewDto: CreateHumanReviewDto): Promise<HumanReview> {
    const review = this.humanReviewRepository.create({
      ...createHumanReviewDto,
      datasetRecord: { id: datasetRecordId } as any,
    })

    return this.humanReviewRepository.save(review)
  }

  async findByDatasetRecord(datasetRecordId: string): Promise<HumanReview[]> {
    return this.humanReviewRepository.find({
      where: { datasetRecord: { id: datasetRecordId } },
      order: { createdAt: "DESC" },
    })
  }

  async findByReviewer(reviewerId: string, status?: ReviewStatus): Promise<HumanReview[]> {
    const where: any = { reviewerId }

    if (status) {
      where.status = status
    }

    return this.humanReviewRepository.find({
      where,
      relations: ["datasetRecord"],
      order: { createdAt: "DESC" },
    })
  }

  async findPendingReviews(limit = 10): Promise<HumanReview[]> {
    return this.humanReviewRepository.find({
      where: { status: ReviewStatus.PENDING },
      relations: ["datasetRecord"],
      order: { createdAt: "ASC" },
      take: limit,
    })
  }

  async update(id: string, updateData: Partial<CreateHumanReviewDto>): Promise<HumanReview> {
    const review = await this.humanReviewRepository.findOne({ where: { id } })

    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`)
    }

    Object.assign(review, updateData)

    return this.humanReviewRepository.save(review)
  }

  async completeReview(
    id: string,
    decision: ReviewDecision,
    comments?: string,
    corrections?: Record<string, any>,
  ): Promise<HumanReview> {
    const review = await this.humanReviewRepository.findOne({
      where: { id },
      relations: ["datasetRecord"],
    })

    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`)
    }

    review.status = ReviewStatus.COMPLETED
    review.decision = decision

    if (comments) {
      review.comments = comments
    }

    if (corrections) {
      review.corrections = corrections
    }

    return this.humanReviewRepository.save(review)
  }

  async getReviewStatistics(reviewerId?: string): Promise<{
    totalReviews: number
    statusBreakdown: Record<ReviewStatus, number>
    decisionBreakdown: Record<ReviewDecision, number>
    averageTimeSpent: number
    averageQualityRating: number
  }> {
    const queryBuilder = this.humanReviewRepository.createQueryBuilder("review")

    if (reviewerId) {
      queryBuilder.where("review.reviewerId = :reviewerId", { reviewerId })
    }

    const totalReviews = await queryBuilder.getCount()

    const statusBreakdown = await queryBuilder
      .select("review.status", "status")
      .addSelect("COUNT(*)", "count")
      .groupBy("review.status")
      .getRawMany()

    const decisionBreakdown = await queryBuilder
      .select("review.decision", "decision")
      .addSelect("COUNT(*)", "count")
      .where("review.decision IS NOT NULL")
      .groupBy("review.decision")
      .getRawMany()

    const averageStats = await queryBuilder
      .select("AVG(review.timeSpentMinutes)", "avgTime")
      .addSelect("AVG(review.qualityRating)", "avgRating")
      .getRawOne()

    return {
      totalReviews,
      statusBreakdown: statusBreakdown.reduce(
        (acc, item) => {
          acc[item.status] = Number.parseInt(item.count)
          return acc
        },
        {} as Record<ReviewStatus, number>,
      ),
      decisionBreakdown: decisionBreakdown.reduce(
        (acc, item) => {
          acc[item.decision] = Number.parseInt(item.count)
          return acc
        },
        {} as Record<ReviewDecision, number>,
      ),
      averageTimeSpent: Math.round((Number.parseFloat(averageStats.avgTime) || 0) * 100) / 100,
      averageQualityRating: Math.round((Number.parseFloat(averageStats.avgRating) || 0) * 100) / 100,
    }
  }

  async assignReview(datasetRecordId: string, reviewerId: string, reviewerName: string): Promise<HumanReview> {
    const existingReview = await this.humanReviewRepository.findOne({
      where: {
        datasetRecord: { id: datasetRecordId },
        status: ReviewStatus.PENDING,
      },
    })

    if (existingReview) {
      existingReview.reviewerId = reviewerId
      existingReview.reviewerName = reviewerName
      existingReview.status = ReviewStatus.IN_PROGRESS
      return this.humanReviewRepository.save(existingReview)
    }

    return this.create(datasetRecordId, {
      reviewerId,
      reviewerName,
      status: ReviewStatus.IN_PROGRESS,
    })
  }
}
