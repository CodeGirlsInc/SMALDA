import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common"
import type { DatasetRecordsService, DatasetRecordFilters } from "../services/dataset-records.service"
import type { CreateDatasetRecordDto } from "../dto/create-dataset-record.dto"
import type { UpdateDatasetRecordDto } from "../dto/update-dataset-record.dto"
import type { DatasetStatus, RiskLevel } from "../entities/dataset-record.entity"
import { RolesGuard } from "../../roles/guards/roles.guard"
import { PermissionsGuard } from "../../roles/guards/permissions.guard"

@Controller("ml-training/dataset-records")
@UseGuards(RolesGuard, PermissionsGuard)
export class DatasetRecordsController {
  constructor(private readonly datasetRecordsService: DatasetRecordsService) {}

  @Post()
  create(createDatasetRecordDto: CreateDatasetRecordDto) {
    return this.datasetRecordsService.create(createDatasetRecordDto)
  }

  @Get()
  findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query("status") status?: string,
    @Query("riskLevel") riskLevel?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("isTrainingData") isTrainingData?: string,
    @Query("isValidationData") isValidationData?: string,
    @Query("isTestData") isTestData?: string,
    @Query("modelVersion") modelVersion?: string,
  ) {
    const filters: DatasetRecordFilters = {}

    if (status) {
      filters.status = status.split(",") as DatasetStatus[]
    }

    if (riskLevel) {
      filters.riskLevel = riskLevel.split(",") as RiskLevel[]
    }

    if (startDate) {
      filters.startDate = new Date(startDate)
    }

    if (endDate) {
      filters.endDate = new Date(endDate)
    }

    if (isTrainingData !== undefined) {
      filters.isTrainingData = isTrainingData === "true"
    }

    if (isValidationData !== undefined) {
      filters.isValidationData = isValidationData === "true"
    }

    if (isTestData !== undefined) {
      filters.isTestData = isTestData === "true"
    }

    if (modelVersion) {
      filters.modelVersion = modelVersion
    }

    return this.datasetRecordsService.findAll(page, limit, filters)
  }

  @Get("statistics")
  getStatistics() {
    return this.datasetRecordsService.getStatistics()
  }

  @Get("source-transaction/:sourceTransactionId")
  findBySourceTransaction(@Param("sourceTransactionId") sourceTransactionId: string) {
    return this.datasetRecordsService.findBySourceTransaction(sourceTransactionId)
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.datasetRecordsService.findOne(id)
  }

  @Patch("bulk-status")
  bulkUpdateStatus(body: { ids: string[]; status: DatasetStatus }) {
    return this.datasetRecordsService.bulkUpdateStatus(body.ids, body.status)
  }

  @Patch(":id")
  update(@Param("id") id: string, updateDatasetRecordDto: UpdateDatasetRecordDto) {
    return this.datasetRecordsService.update(id, updateDatasetRecordDto)
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.datasetRecordsService.remove(id)
  }
}
