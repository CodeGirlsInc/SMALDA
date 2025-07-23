import { Injectable, NotFoundException } from "@nestjs/common"
import type { Repository } from "typeorm"
import * as fs from "fs/promises"
import * as path from "path"
import { type TrainingExport, ExportFormat, ExportStatus } from "../entities/training-export.entity"
import type { DatasetRecord } from "../entities/dataset-record.entity"
import type { ExportTrainingDataDto } from "../dto/export-training-data.dto"

@Injectable()
export class TrainingExportService {
  constructor(
    private trainingExportRepository: Repository<TrainingExport>,
    private datasetRecordRepository: Repository<DatasetRecord>,
  ) {}

  async createExport(
    exportDto: ExportTrainingDataDto,
    exportedBy: string,
    exporterName: string,
  ): Promise<TrainingExport> {
    const trainingExport = this.trainingExportRepository.create({
      name: exportDto.name,
      description: exportDto.description,
      format: exportDto.format || ExportFormat.JSON,
      filters: this.buildFilters(exportDto),
      exportedBy,
      exporterName,
      status: ExportStatus.PENDING,
    })

    const savedExport = await this.trainingExportRepository.save(trainingExport)

    // Process export asynchronously
    this.processExport(savedExport.id, exportDto).catch((error) => {
      console.error(`Export ${savedExport.id} failed:`, error)
      this.updateExportStatus(savedExport.id, ExportStatus.FAILED, error.message)
    })

    return savedExport
  }

  async findAll(): Promise<TrainingExport[]> {
    return this.trainingExportRepository.find({
      order: { createdAt: "DESC" },
    })
  }

  async findOne(id: string): Promise<TrainingExport> {
    const trainingExport = await this.trainingExportRepository.findOne({ where: { id } })

    if (!trainingExport) {
      throw new NotFoundException(`Training export with ID ${id} not found`)
    }

    return trainingExport
  }

  async downloadExport(id: string): Promise<{ filePath: string; fileName: string }> {
    const trainingExport = await this.findOne(id)

    if (trainingExport.status !== ExportStatus.COMPLETED || !trainingExport.filePath) {
      throw new NotFoundException("Export file not available")
    }

    const fileName = `${trainingExport.name}.${trainingExport.format}`

    return {
      filePath: trainingExport.filePath,
      fileName,
    }
  }

  private async processExport(exportId: string, exportDto: ExportTrainingDataDto): Promise<void> {
    await this.updateExportStatus(exportId, ExportStatus.IN_PROGRESS)

    try {
      // Build query based on filters
      const queryBuilder = this.datasetRecordRepository
        .createQueryBuilder("record")
        .leftJoinAndSelect("record.tags", "tags")
        .leftJoinAndSelect("record.humanReviews", "humanReviews")
        .leftJoinAndSelect("record.feedback", "feedback")

      this.applyFilters(queryBuilder, exportDto)

      const records = await queryBuilder.getMany()

      // Generate export data
      const exportData = this.formatExportData(records, exportDto.format || ExportFormat.JSON)

      // Save to file
      const fileName = `export_${exportId}.${exportDto.format || ExportFormat.JSON}`
      const filePath = path.join(process.cwd(), "exports", fileName)

      // Ensure exports directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true })

      await fs.writeFile(filePath, exportData)

      const stats = await fs.stat(filePath)

      // Update export record
      await this.trainingExportRepository.update(exportId, {
        status: ExportStatus.COMPLETED,
        recordCount: records.length,
        filePath,
        fileSizeBytes: stats.size,
        completedAt: new Date(),
      })
    } catch (error) {
      await this.updateExportStatus(exportId, ExportStatus.FAILED, error.message)
      throw error
    }
  }

  private buildFilters(exportDto: ExportTrainingDataDto): Record<string, any> {
    return {
      statusFilter: exportDto.statusFilter,
      riskLevelFilter: exportDto.riskLevelFilter,
      startDate: exportDto.startDate,
      endDate: exportDto.endDate,
      includeTrainingData: exportDto.includeTrainingData,
      includeValidationData: exportDto.includeValidationData,
      includeTestData: exportDto.includeTestData,
      tagFilter: exportDto.tagFilter,
      additionalFilters: exportDto.additionalFilters,
    }
  }

  private applyFilters(queryBuilder: any, exportDto: ExportTrainingDataDto): void {
    if (exportDto.statusFilter && exportDto.statusFilter.length > 0) {
      queryBuilder.andWhere("record.status IN (:...statuses)", { statuses: exportDto.statusFilter })
    }

    if (exportDto.riskLevelFilter && exportDto.riskLevelFilter.length > 0) {
      queryBuilder.andWhere("record.actualRiskLevel IN (:...riskLevels)", { riskLevels: exportDto.riskLevelFilter })
    }

    if (exportDto.startDate) {
      queryBuilder.andWhere("record.createdAt >= :startDate", { startDate: exportDto.startDate })
    }

    if (exportDto.endDate) {
      queryBuilder.andWhere("record.createdAt <= :endDate", { endDate: exportDto.endDate })
    }

    if (exportDto.includeTrainingData === true) {
      queryBuilder.andWhere("record.isTrainingData = :isTrainingData", { isTrainingData: true })
    }

    if (exportDto.includeValidationData === true) {
      queryBuilder.andWhere("record.isValidationData = :isValidationData", { isValidationData: true })
    }

    if (exportDto.includeTestData === true) {
      queryBuilder.andWhere("record.isTestData = :isTestData", { isTestData: true })
    }

    if (exportDto.tagFilter && exportDto.tagFilter.length > 0) {
      queryBuilder.andWhere("tags.name IN (:...tagNames)", { tagNames: exportDto.tagFilter })
    }
  }

  private formatExportData(records: DatasetRecord[], format: ExportFormat): string {
    const exportData = records.map((record) => ({
      id: record.id,
      inputData: record.inputData,
      features: record.features,
      predictedRiskLevel: record.predictedRiskLevel,
      actualRiskLevel: record.actualRiskLevel,
      confidenceScore: record.confidenceScore,
      status: record.status,
      notes: record.notes,
      sourceTransactionId: record.sourceTransactionId,
      modelVersion: record.modelVersion,
      isTrainingData: record.isTrainingData,
      isValidationData: record.isValidationData,
      isTestData: record.isTestData,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      tags:
        record.tags?.map((tag) => ({
          name: tag.name,
          value: tag.value,
          category: tag.category,
          weight: tag.weight,
        })) || [],
      humanReviews:
        record.humanReviews?.map((review) => ({
          reviewerId: review.reviewerId,
          reviewerName: review.reviewerName,
          status: review.status,
          decision: review.decision,
          reviewedRiskLevel: review.reviewedRiskLevel,
          comments: review.comments,
          corrections: review.corrections,
          qualityRating: review.qualityRating,
          timeSpentMinutes: review.timeSpentMinutes,
          createdAt: review.createdAt,
        })) || [],
      feedback:
        record.feedback?.map((fb) => ({
          type: fb.type,
          source: fb.source,
          rating: fb.rating,
          comments: fb.comments,
          metadata: fb.metadata,
          submitterName: fb.submitterName,
          isUsefulForTraining: fb.isUsefulForTraining,
          createdAt: fb.createdAt,
        })) || [],
    }))

    switch (format) {
      case ExportFormat.JSON:
        return JSON.stringify(exportData, null, 2)

      case ExportFormat.JSONL:
        return exportData.map((record) => JSON.stringify(record)).join("\n")

      case ExportFormat.CSV:
        return this.convertToCSV(exportData)

      default:
        return JSON.stringify(exportData, null, 2)
    }
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return ""

    // Flatten the data structure for CSV
    const flattenedData = data.map((record) => ({
      id: record.id,
      inputData: record.inputData,
      features: JSON.stringify(record.features),
      predictedRiskLevel: record.predictedRiskLevel,
      actualRiskLevel: record.actualRiskLevel,
      confidenceScore: record.confidenceScore,
      status: record.status,
      notes: record.notes,
      sourceTransactionId: record.sourceTransactionId,
      modelVersion: record.modelVersion,
      isTrainingData: record.isTrainingData,
      isValidationData: record.isValidationData,
      isTestData: record.isTestData,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      tagCount: record.tags.length,
      reviewCount: record.humanReviews.length,
      feedbackCount: record.feedback.length,
      averageFeedbackRating:
        record.feedback.length > 0
          ? record.feedback.reduce((sum: number, fb: any) => sum + fb.rating, 0) / record.feedback.length
          : null,
    }))

    const headers = Object.keys(flattenedData[0])
    const csvContent = [
      headers.join(","),
      ...flattenedData.map((row) =>
        headers
          .map((header) => {
            const value = row[header]
            return typeof value === "string" ? `"${value.replace(/"/g, '""')}"` : value
          })
          .join(","),
      ),
    ].join("\n")

    return csvContent
  }

  private async updateExportStatus(exportId: string, status: ExportStatus, errorMessage?: string): Promise<void> {
    const updateData: any = { status }

    if (errorMessage) {
      updateData.errorMessage = errorMessage
    }

    await this.trainingExportRepository.update(exportId, updateData)
  }

  async remove(id: string): Promise<void> {
    const trainingExport = await this.findOne(id)

    // Delete file if it exists
    if (trainingExport.filePath) {
      try {
        await fs.unlink(trainingExport.filePath)
      } catch (error) {
        console.warn(`Could not delete export file: ${trainingExport.filePath}`)
      }
    }

    await this.trainingExportRepository.remove(trainingExport)
  }
}
