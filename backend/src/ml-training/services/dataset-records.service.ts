import { Injectable, NotFoundException } from "@nestjs/common"
import { type Repository, type FindManyOptions, Between } from "typeorm"
import type { DatasetRecord, DatasetStatus, RiskLevel } from "../entities/dataset-record.entity"
import type { CreateDatasetRecordDto } from "../dto/create-dataset-record.dto"
import type { UpdateDatasetRecordDto } from "../dto/update-dataset-record.dto"

export interface DatasetRecordFilters {
  status?: DatasetStatus[]
  riskLevel?: RiskLevel[]
  startDate?: Date
  endDate?: Date
  isTrainingData?: boolean
  isValidationData?: boolean
  isTestData?: boolean
  modelVersion?: string
}

@Injectable()
export class DatasetRecordsService {
  private datasetRecordRepository: Repository<DatasetRecord>

  constructor(datasetRecordRepository: Repository<DatasetRecord>) {
    this.datasetRecordRepository = datasetRecordRepository
  }

  async create(createDatasetRecordDto: CreateDatasetRecordDto): Promise<DatasetRecord> {
    const datasetRecord = this.datasetRecordRepository.create(createDatasetRecordDto)
    return this.datasetRecordRepository.save(datasetRecord)
  }

  async findAll(
    page = 1,
    limit = 10,
    filters?: DatasetRecordFilters,
  ): Promise<{ data: DatasetRecord[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit

    const queryOptions: FindManyOptions<DatasetRecord> = {
      relations: ["tags", "humanReviews", "feedback"],
      skip,
      take: limit,
      order: { createdAt: "DESC" },
    }

    if (filters) {
      const where: any = {}

      if (filters.status && filters.status.length > 0) {
        where.status = filters.status.length === 1 ? filters.status[0] : { $in: filters.status }
      }

      if (filters.riskLevel && filters.riskLevel.length > 0) {
        where.actualRiskLevel = filters.riskLevel.length === 1 ? filters.riskLevel[0] : { $in: filters.riskLevel }
      }

      if (filters.startDate && filters.endDate) {
        where.createdAt = Between(filters.startDate, filters.endDate)
      }

      if (filters.isTrainingData !== undefined) {
        where.isTrainingData = filters.isTrainingData
      }

      if (filters.isValidationData !== undefined) {
        where.isValidationData = filters.isValidationData
      }

      if (filters.isTestData !== undefined) {
        where.isTestData = filters.isTestData
      }

      if (filters.modelVersion) {
        where.modelVersion = filters.modelVersion
      }

      queryOptions.where = where
    }

    const [data, total] = await this.datasetRecordRepository.findAndCount(queryOptions)

    return {
      data,
      total,
      page,
      limit,
    }
  }

  async findOne(id: string): Promise<DatasetRecord> {
    const datasetRecord = await this.datasetRecordRepository.findOne({
      where: { id },
      relations: ["tags", "humanReviews", "feedback"],
    })

    if (!datasetRecord) {
      throw new NotFoundException(`Dataset record with ID ${id} not found`)
    }

    return datasetRecord
  }

  async update(id: string, updateDatasetRecordDto: UpdateDatasetRecordDto): Promise<DatasetRecord> {
    const datasetRecord = await this.findOne(id)

    Object.assign(datasetRecord, updateDatasetRecordDto)

    return this.datasetRecordRepository.save(datasetRecord)
  }

  async remove(id: string): Promise<void> {
    const datasetRecord = await this.findOne(id)
    await this.datasetRecordRepository.remove(datasetRecord)
  }

  async getStatistics(): Promise<{
    totalRecords: number
    statusBreakdown: Record<DatasetStatus, number>
    riskLevelBreakdown: Record<RiskLevel, number>
    trainingDataCount: number
    validationDataCount: number
    testDataCount: number
  }> {
    const totalRecords = await this.datasetRecordRepository.count()

    const statusBreakdown = await this.datasetRecordRepository
      .createQueryBuilder("record")
      .select("record.status", "status")
      .addSelect("COUNT(*)", "count")
      .groupBy("record.status")
      .getRawMany()

    const riskLevelBreakdown = await this.datasetRecordRepository
      .createQueryBuilder("record")
      .select("record.actualRiskLevel", "riskLevel")
      .addSelect("COUNT(*)", "count")
      .where("record.actualRiskLevel IS NOT NULL")
      .groupBy("record.actualRiskLevel")
      .getRawMany()

    const trainingDataCount = await this.datasetRecordRepository.count({
      where: { isTrainingData: true },
    })

    const validationDataCount = await this.datasetRecordRepository.count({
      where: { isValidationData: true },
    })

    const testDataCount = await this.datasetRecordRepository.count({
      where: { isTestData: true },
    })

    return {
      totalRecords,
      statusBreakdown: statusBreakdown.reduce(
        (acc, item) => {
          acc[item.status] = Number.parseInt(item.count)
          return acc
        },
        {} as Record<DatasetStatus, number>,
      ),
      riskLevelBreakdown: riskLevelBreakdown.reduce(
        (acc, item) => {
          acc[item.riskLevel] = Number.parseInt(item.count)
          return acc
        },
        {} as Record<RiskLevel, number>,
      ),
      trainingDataCount,
      validationDataCount,
      testDataCount,
    }
  }

  async bulkUpdateStatus(ids: string[], status: DatasetStatus): Promise<void> {
    await this.datasetRecordRepository.update(ids, { status })
  }

  async findBySourceTransaction(sourceTransactionId: string): Promise<DatasetRecord[]> {
    return this.datasetRecordRepository.find({
      where: { sourceTransactionId },
      relations: ["tags", "humanReviews", "feedback"],
    })
  }
}
