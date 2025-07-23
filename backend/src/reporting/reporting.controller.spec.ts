import { Test, type TestingModule } from "@nestjs/testing"
import type { Response } from "express"
import { ReportingController } from "./reporting.controller"
import { ReportingService } from "./reporting.service"
import { AdminGuard } from "../admin/guards/admin.guard"
import { ReportType, ReportFormat, ReportStatus } from "./entities/report.entity"
import type { GenerateReportDto } from "./dto/generate-report.dto"
import type { ReportQueryDto } from "./dto/report-query.dto"
import { jest } from "@jest/globals"

describe("ReportingController", () => {
  let controller: ReportingController
  let service: ReportingService

  const mockReport = {
    id: "report-123",
    type: ReportType.DOCUMENT_ANALYSIS,
    format: ReportFormat.PDF,
    status: ReportStatus.COMPLETED,
    title: "Document Analysis Report",
    description: "Analysis of uploaded documents",
    parameters: {},
    generatedBy: "admin-123",
    generatedByEmail: "admin@example.com",
    filePath: "/path/to/report.pdf",
    fileName: "report.pdf",
    fileSize: 1024,
    downloadUrl: "/api/reports/report-123/download",
    expiresAt: new Date(),
    downloadCount: 0,
    errorMessage: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockReportingService = {
    generateReport: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    downloadReport: jest.fn(),
    deleteReport: jest.fn(),
    getReportStatistics: jest.fn(),
    cleanupExpiredReports: jest.fn(),
    retryFailedReports: jest.fn(),
  }

  const mockAdminGuard = {
    canActivate: jest.fn().mockReturnValue(true),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportingController],
      providers: [
        {
          provide: ReportingService,
          useValue: mockReportingService,
        },
        {
          provide: AdminGuard,
          useValue: mockAdminGuard,
        },
      ],
    }).compile()

    controller = module.get<ReportingController>(ReportingController)
    service = module.get<ReportingService>(ReportingService)

    jest.clearAllMocks()
  })

  describe("generateReport", () => {
    it("should generate a report", async () => {
      const generateDto: GenerateReportDto = {
        type: ReportType.DOCUMENT_ANALYSIS,
        format: ReportFormat.PDF,
        title: "Test Report",
        description: "Test description",
        generatedBy: "admin-123",
        generatedByEmail: "admin@example.com",
      }

      mockReportingService.generateReport.mockResolvedValue(mockReport)

      const result = await controller.generateReport(generateDto)

      expect(service.generateReport).toHaveBeenCalledWith(generateDto)
      expect(result).toEqual(mockReport)
    })
  })

  describe("findAll", () => {
    it("should return paginated reports", async () => {
      const query: ReportQueryDto = {
        type: ReportType.DOCUMENT_ANALYSIS,
        limit: 10,
        offset: 0,
      }

      const response = {
        reports: [mockReport],
        total: 1,
        limit: 10,
        offset: 0,
      }

      mockReportingService.findAll.mockResolvedValue(response)

      const result = await controller.findAll(query)

      expect(service.findAll).toHaveBeenCalledWith(query)
      expect(result).toEqual(response)
    })
  })

  describe("findOne", () => {
    it("should return a specific report", async () => {
      mockReportingService.findOne.mockResolvedValue(mockReport)

      const result = await controller.findOne("report-123")

      expect(service.findOne).toHaveBeenCalledWith("report-123")
      expect(result).toEqual(mockReport)
    })
  })

  describe("downloadReport", () => {
    it("should download a report", async () => {
      const mockResponse = {
        set: jest.fn(),
        send: jest.fn(),
      } as unknown as Response

      const buffer = Buffer.from("test report content")
      mockReportingService.downloadReport.mockResolvedValue({
        buffer,
        report: mockReport,
      })

      await controller.downloadReport("report-123", mockResponse)

      expect(service.downloadReport).toHaveBeenCalledWith("report-123")
      expect(mockResponse.set).toHaveBeenCalledWith({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="report.pdf"',
        "Content-Length": "1024",
      })
      expect(mockResponse.send).toHaveBeenCalledWith(buffer)
    })
  })

  describe("deleteReport", () => {
    it("should delete a report", async () => {
      mockReportingService.deleteReport.mockResolvedValue(undefined)

      const result = await controller.deleteReport("report-123")

      expect(service.deleteReport).toHaveBeenCalledWith("report-123")
      expect(result).toEqual({ message: "Report deleted successfully" })
    })
  })

  describe("getStatistics", () => {
    it("should return report statistics", async () => {
      const stats = {
        total: 100,
        byType: { DOCUMENT_ANALYSIS: 50, RISK_SUMMARY: 30 },
        byFormat: { PDF: 70, CSV: 30 },
        byStatus: { COMPLETED: 80, PENDING: 15, FAILED: 5 },
        totalDownloads: 250,
        averageFileSize: 2048,
      }

      mockReportingService.getReportStatistics.mockResolvedValue(stats)

      const result = await controller.getStatistics("admin-123")

      expect(service.getReportStatistics).toHaveBeenCalledWith("admin-123")
      expect(result).toEqual(stats)
    })
  })

  describe("cleanupExpiredReports", () => {
    it("should cleanup expired reports", async () => {
      mockReportingService.cleanupExpiredReports.mockResolvedValue(5)

      const result = await controller.cleanupExpiredReports()

      expect(service.cleanupExpiredReports).toHaveBeenCalled()
      expect(result).toEqual({ message: "Expired reports cleaned up", deletedCount: 5 })
    })
  })

  describe("retryFailedReports", () => {
    it("should retry failed reports", async () => {
      mockReportingService.retryFailedReports.mockResolvedValue(3)

      const result = await controller.retryFailedReports()

      expect(service.retryFailedReports).toHaveBeenCalled()
      expect(result).toEqual({ message: "Failed reports queued for retry", retryCount: 3 })
    })
  })
})
