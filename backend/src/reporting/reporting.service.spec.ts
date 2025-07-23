import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import { getQueueToken } from "@nestjs/bull"
import type { Repository } from "typeorm"
import type { Queue } from "bull"
import { ReportingService } from "./reporting.service"
import { Report, ReportType, ReportFormat, ReportStatus } from "./entities/report.entity"
import { DataAggregatorService } from "./services/data-aggregator.service"
import { PdfGeneratorService } from "./services/pdf-generator.service"
import { CsvGeneratorService } from "./services/csv-generator.service"
import type { GenerateReportDto } from "./dto/generate-report.dto"
import type { ReportQueryDto } from "./dto/report-query.dto"
import * as fs from "fs"
import { jest } from "@jest/globals"

// Mock fs module
jest.mock("fs")
const mockedFs = fs as jest.Mocked<typeof fs>

describe("ReportingService", () => {
  let service: ReportingService
  let repository: Repository<Report>
  let queue: Queue

  const mockReport: Report = {
    id: "report-123",
    type: ReportType.DOCUMENT_ANALYSIS,
    format: ReportFormat.PDF,
    status: ReportStatus.PENDING,
    title: "Document Analysis Report",
    description: "Analysis of uploaded documents",
    parameters: {
      startDate: "2024-01-01",
      endDate: "2024-01-31",
    },
    generatedBy: "admin-123",
    generatedByEmail: "admin@example.com",
    filePath: null,
    fileName: null,
    fileSize: 0,
    downloadUrl: null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    downloadCount: 0,
    errorMessage: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    increment: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const mockQueue = {
    add: jest.fn(),
  }

  const mockDataAggregatorService = {
    aggregateDocumentAnalysisData: jest.fn(),
    aggregateRiskSummaryData: jest.fn(),
    aggregateAuditTrailData: jest.fn(),
    aggregateUserActivityData: jest.fn(),
    aggregateSystemOverviewData: jest.fn(),
    aggregateComplianceData: jest.fn(),
  }

  const mockPdfGeneratorService = {
    generateDocumentAnalysisReport: jest.fn(),
    generateRiskSummaryReport: jest.fn(),
    generateAuditTrailReport: jest.fn(),
    generateUserActivityReport: jest.fn(),
    generateSystemOverviewReport: jest.fn(),
    generateComplianceReport: jest.fn(),
  }

  const mockCsvGeneratorService = {
    generateDocumentAnalysisReport: jest.fn(),
    generateRiskSummaryReport: jest.fn(),
    generateAuditTrailReport: jest.fn(),
    generateUserActivityReport: jest.fn(),
    generateSystemOverviewReport: jest.fn(),
    generateComplianceReport: jest.fn(),
  }

  const mockQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingService,
        {
          provide: getRepositoryToken(Report),
          useValue: mockRepository,
        },
        {
          provide: getQueueToken("report"),
          useValue: mockQueue,
        },
        {
          provide: DataAggregatorService,
          useValue: mockDataAggregatorService,
        },
        {
          provide: PdfGeneratorService,
          useValue: mockPdfGeneratorService,
        },
        {
          provide: CsvGeneratorService,
          useValue: mockCsvGeneratorService,
        },
      ],
    }).compile()

    service = module.get<ReportingService>(ReportingService)
    repository = module.get<Repository<Report>>(getRepositoryToken(Report))
    queue = module.get<Queue>(getQueueToken("report"))

    jest.clearAllMocks()
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)

    // Mock fs methods
    mockedFs.existsSync.mockReturnValue(true)
    mockedFs.mkdirSync.mockReturnValue(undefined)
    mockedFs.readFileSync.mockReturnValue(Buffer.from("test report content"))
    mockedFs.unlinkSync.mockReturnValue(undefined)
    mockedFs.statSync.mockReturnValue({ size: 1024 } as any)
  })

  describe("generateReport", () => {
    it("should create and queue a report for generation", async () => {
      const generateDto: GenerateReportDto = {
        type: ReportType.DOCUMENT_ANALYSIS,
        format: ReportFormat.PDF,
        title: "Test Report",
        description: "Test description",
        generatedBy: "admin-123",
        generatedByEmail: "admin@example.com",
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      }

      mockRepository.create.mockReturnValue(mockReport)
      mockRepository.save.mockResolvedValue(mockReport)
      mockQueue.add.mockResolvedValue({})

      const result = await service.generateReport(generateDto)

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: generateDto.type,
          format: generateDto.format,
          title: generateDto.title,
          status: ReportStatus.PENDING,
        }),
      )
      expect(repository.save).toHaveBeenCalledWith(mockReport)
      expect(queue.add).toHaveBeenCalledWith(
        "generate-report",
        { reportId: mockReport.id },
        expect.objectContaining({
          attempts: 3,
          backoff: expect.any(Object),
        }),
      )
      expect(result).toEqual(mockReport)
    })
  })

  describe("processReportGeneration", () => {
    it("should process document analysis report generation", async () => {
      const completedReport = { ...mockReport, status: ReportStatus.GENERATING }
      mockRepository.findOne.mockResolvedValue(completedReport)
      mockRepository.update.mockResolvedValue({})

      const mockData = {
        documents: [],
        summary: {
          totalDocuments: 0,
          byRiskLevel: {},
          byMimeType: {},
          averageRiskScore: 0,
          totalSize: 0,
        },
      }

      mockDataAggregatorService.aggregateDocumentAnalysisData.mockResolvedValue(mockData)
      mockPdfGeneratorService.generateDocumentAnalysisReport.mockResolvedValue(undefined)

      await service.processReportGeneration("report-123")

      expect(mockDataAggregatorService.aggregateDocumentAnalysisData).toHaveBeenCalled()
      expect(mockPdfGeneratorService.generateDocumentAnalysisReport).toHaveBeenCalledWith(
        mockData,
        completedReport.title,
        expect.any(String),
      )
      expect(repository.update).toHaveBeenCalledWith(
        "report-123",
        expect.objectContaining({
          status: ReportStatus.COMPLETED,
          filePath: expect.any(String),
          fileName: expect.any(String),
          fileSize: 1024,
        }),
      )
    })

    it("should handle CSV format generation", async () => {
      const csvReport = { ...mockReport, format: ReportFormat.CSV, status: ReportStatus.GENERATING }
      mockRepository.findOne.mockResolvedValue(csvReport)
      mockRepository.update.mockResolvedValue({})

      const mockData = {
        documents: [],
        summary: {
          totalDocuments: 0,
          byRiskLevel: {},
          byMimeType: {},
          averageRiskScore: 0,
          totalSize: 0,
        },
      }

      mockDataAggregatorService.aggregateDocumentAnalysisData.mockResolvedValue(mockData)
      mockCsvGeneratorService.generateDocumentAnalysisReport.mockResolvedValue(undefined)

      await service.processReportGeneration("report-123")

      expect(mockCsvGeneratorService.generateDocumentAnalysisReport).toHaveBeenCalledWith(mockData, expect.any(String))
    })

    it("should handle generation errors", async () => {
      mockRepository.findOne.mockResolvedValue(mockReport)
      mockRepository.update.mockResolvedValue({})
      mockDataAggregatorService.aggregateDocumentAnalysisData.mockRejectedValue(new Error("Data aggregation failed"))

      await expect(service.processReportGeneration("report-123")).rejects.toThrow("Data aggregation failed")

      expect(repository.update).toHaveBeenCalledWith(
        "report-123",
        expect.objectContaining({
          status: ReportStatus.FAILED,
          errorMessage: "Data aggregation failed",
        }),
      )
    })
  })

  describe("findAll", () => {
    it("should return paginated reports", async () => {
      const query: ReportQueryDto = {
        type: ReportType.DOCUMENT_ANALYSIS,
        limit: 10,
        offset: 0,
      }

      const reports = [mockReport]
      mockQueryBuilder.getManyAndCount.mockResolvedValue([reports, 1])

      const result = await service.findAll(query)

      expect(repository.createQueryBuilder).toHaveBeenCalledWith("report")
      expect(result).toEqual({
        reports,
        total: 1,
        limit: 10,
        offset: 0,
      })
    })

    it("should handle search query", async () => {
      const query: ReportQueryDto = {
        search: "analysis",
        limit: 50,
        offset: 0,
      }

      const reports = [mockReport]
      mockQueryBuilder.getManyAndCount.mockResolvedValue([reports, 1])

      const result = await service.findAll(query)

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "(report.title ILIKE :search OR report.description ILIKE :search)",
        { search: "%analysis%" },
      )
      expect(result.reports).toEqual(reports)
    })
  })

  describe("downloadReport", () => {
    it("should return report buffer for completed report", async () => {
      const completedReport = {
        ...mockReport,
        status: ReportStatus.COMPLETED,
        filePath: "/path/to/report.pdf",
        fileName: "report.pdf",
        fileSize: 1024,
      }

      mockRepository.findOne.mockResolvedValue(completedReport)
      mockRepository.increment.mockResolvedValue({})

      const result = await service.downloadReport("report-123")

      expect(fs.readFileSync).toHaveBeenCalledWith(completedReport.filePath)
      expect(repository.increment).toHaveBeenCalledWith({ id: "report-123" }, "downloadCount", 1)
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.report).toEqual(completedReport)
    })

    it("should throw error for non-completed report", async () => {
      mockRepository.findOne.mockResolvedValue(mockReport)

      await expect(service.downloadReport("report-123")).rejects.toThrow("Report is not ready for download")
    })

    it("should throw error for expired report", async () => {
      const expiredReport = {
        ...mockReport,
        status: ReportStatus.COMPLETED,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      }

      mockRepository.findOne.mockResolvedValue(expiredReport)

      await expect(service.downloadReport("report-123")).rejects.toThrow("Report has expired")
    })
  })

  describe("getReportStatistics", () => {
    it("should return report statistics", async () => {
      const reports = [
        mockReport,
        { ...mockReport, id: "report-124", type: ReportType.RISK_SUMMARY, downloadCount: 5, fileSize: 2048 },
      ]
      mockRepository.find.mockResolvedValue(reports)

      const result = await service.getReportStatistics()

      expect(result.total).toBe(2)
      expect(result.byType[ReportType.DOCUMENT_ANALYSIS]).toBe(1)
      expect(result.byType[ReportType.RISK_SUMMARY]).toBe(1)
      expect(result.totalDownloads).toBe(5)
      expect(result.averageFileSize).toBe(1024) // (0 + 2048) / 2
    })
  })

  describe("cleanupExpiredReports", () => {
    it("should cleanup expired reports", async () => {
      const expiredReports = [
        {
          ...mockReport,
          id: "expired-1",
          status: ReportStatus.COMPLETED,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          filePath: "/path/to/expired1.pdf",
        },
        {
          ...mockReport,
          id: "expired-2",
          status: ReportStatus.COMPLETED,
          expiresAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
          filePath: "/path/to/expired2.pdf",
        },
      ]

      mockRepository.find.mockResolvedValue(expiredReports)
      mockRepository.update.mockResolvedValue({})

      const result = await service.cleanupExpiredReports()

      expect(fs.unlinkSync).toHaveBeenCalledTimes(2)
      expect(repository.update).toHaveBeenCalledTimes(2)
      expect(result).toBe(2)
    })
  })

  describe("retryFailedReports", () => {
    it("should retry failed reports", async () => {
      const failedReports = [
        { ...mockReport, id: "failed-1", status: ReportStatus.FAILED },
        { ...mockReport, id: "failed-2", status: ReportStatus.FAILED },
      ]

      mockRepository.find.mockResolvedValue(failedReports)
      mockRepository.update.mockResolvedValue({})
      mockQueue.add.mockResolvedValue({})

      const result = await service.retryFailedReports()

      expect(repository.update).toHaveBeenCalledTimes(2)
      expect(queue.add).toHaveBeenCalledTimes(2)
      expect(result).toBe(2)
    })
  })
})
