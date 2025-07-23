import { Injectable, NotFoundException } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { Feedback, FeedbackType, FeedbackSource } from "../entities/feedback.entity"
import type { CreateFeedbackDto } from "../dto/create-feedback.dto"

@Injectable()
export class FeedbackService {
  constructor(private feedbackRepository: Repository<Feedback>) {}

  async create(datasetRecordId: string, createFeedbackDto: CreateFeedbackDto): Promise<Feedback> {
    const feedback = this.feedbackRepository.create({
      ...createFeedbackDto,
      datasetRecord: { id: datasetRecordId } as any,
    })

    return this.feedbackRepository.save(feedback)
  }

  async findByDatasetRecord(datasetRecordId: string): Promise<Feedback[]> {
    return this.feedbackRepository.find({
      where: { datasetRecord: { id: datasetRecordId } },
      order: { createdAt: "DESC" },
    })
  }

  async findBySubmitter(submittedBy: string): Promise<Feedback[]> {
    return this.feedbackRepository.find({
      where: { submittedBy },
      relations: ["datasetRecord"],
      order: { createdAt: "DESC" },
    })
  }

  async findByType(type: FeedbackType): Promise<Feedback[]> {
    return this.feedbackRepository.find({
      where: { type },
      relations: ["datasetRecord"],
      order: { createdAt: "DESC" },
    })
  }

  async findBySource(source: FeedbackSource): Promise<Feedback[]> {
    return this.feedbackRepository.find({
      where: { source },
      relations: ["datasetRecord"],
      order: { createdAt: "DESC" },
    })
  }

  async update(id: string, updateData: Partial<CreateFeedbackDto>): Promise<Feedback> {
    const feedback = await this.feedbackRepository.findOne({ where: { id } })

    if (!feedback) {
      throw new NotFoundException(`Feedback with ID ${id} not found`)
    }

    Object.assign(feedback, updateData)

    return this.feedbackRepository.save(feedback)
  }

  async remove(id: string): Promise<void> {
    const feedback = await this.feedbackRepository.findOne({ where: { id } })

    if (!feedback) {
      throw new NotFoundException(`Feedback with ID ${id} not found`)
    }

    await this.feedbackRepository.remove(feedback)
  }

  async getFeedbackStatistics(): Promise<{
    totalFeedback: number
    typeBreakdown: Record<FeedbackType, number>
    sourceBreakdown: Record<FeedbackSource, number>
    averageRating: number
    usefulForTrainingCount: number
  }> {
    const totalFeedback = await this.feedbackRepository.count()

    const typeBreakdown = await this.feedbackRepository
      .createQueryBuilder("feedback")
      .select("feedback.type", "type")
      .addSelect("COUNT(*)", "count")
      .groupBy("feedback.type")
      .getRawMany()

    const sourceBreakdown = await this.feedbackRepository
      .createQueryBuilder("feedback")
      .select("feedback.source", "source")
      .addSelect("COUNT(*)", "count")
      .groupBy("feedback.source")
      .getRawMany()

    const averageRating = await this.feedbackRepository
      .createQueryBuilder("feedback")
      .select("AVG(feedback.rating)", "avgRating")
      .getRawOne()

    const usefulForTrainingCount = await this.feedbackRepository.count({
      where: { isUsefulForTraining: true },
    })

    return {
      totalFeedback,
      typeBreakdown: typeBreakdown.reduce(
        (acc, item) => {
          acc[item.type] = Number.parseInt(item.count)
          return acc
        },
        {} as Record<FeedbackType, number>,
      ),
      sourceBreakdown: sourceBreakdown.reduce(
        (acc, item) => {
          acc[item.source] = Number.parseInt(item.count)
          return acc
        },
        {} as Record<FeedbackSource, number>,
      ),
      averageRating: Math.round((Number.parseFloat(averageRating.avgRating) || 0) * 100) / 100,
      usefulForTrainingCount,
    }
  }

  async getAverageRatingByDatasetRecord(datasetRecordId: string): Promise<number> {
    const result = await this.feedbackRepository
      .createQueryBuilder("feedback")
      .select("AVG(feedback.rating)", "avgRating")
      .where("feedback.datasetRecordId = :datasetRecordId", { datasetRecordId })
      .getRawOne()

    return Math.round((Number.parseFloat(result.avgRating) || 0) * 100) / 100
  }
}
