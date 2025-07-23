import { Test, type TestingModule } from "@nestjs/testing"
import { RiskAnalysisController } from "./risk-analysis.controller"
import { RiskAnalysisService } from "./risk-analysis.service"
import { RiskLevel } from "./entities/risk-analysis.entity"
import type { AnalyzeDocumentDto } from "./dto/analyze-document.dto"
import type { RiskReportDto } from "./dto/risk-report.dto"
import { jest } from "@jest/globals"

describe("RiskAnalysisController", () => {
  let controller: RiskAnalysisController
  let service: RiskAnalysisService

  const mockRiskReport: RiskReportDto = {
    id: "analysis-123",
    documentId: "doc-123",
    riskLevel: RiskLevel.MEDIUM,
    summary: "Medium risk detected",
    detectedKeywords: ["dispute", "incomplete"],
    riskFactors: [
      {
        category: "Legal Disputes",
        severity: "HIGH",
        description: "Detected dispute-related keywords",
        keywords: ["dispute"],
        score: 20,
      },
    ],
    riskScore: 20,
    analyzedBy: "user123",
    analysisMethod: "STATIC_RULES",
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockRiskAnalysisService = {
    analyzeDocument: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByDocumentId: jest.fn(),
    findByRiskLevel: jest.fn(),
    reanalyzeDocument: jest.fn(),
    deleteAnalysis: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RiskAnalysisController],
      providers: [
        {
          provide: RiskAnalysisService,
          useValue: mockRiskAnalysisService,
        },
      ],
    }).compile()

    controller = module.get<RiskAnalysisController>(RiskAnalysisController)
    service = module.get<RiskAnalysisService>(RiskAnalysisService)

    jest.clearAllMocks()
  })

  describe("analyzeDocument", () => {
    it("should analyze document", async () => {
      const analyzeDto: AnalyzeDocumentDto = {
        documentId: "doc-123",
        analyzedBy: "user123",
        analysisMethod: "STATIC_RULES" as any,
      }
      mockRiskAnalysisService.analyzeDocument.mockResolvedValue(mockRiskReport)

      const result = await controller.analyzeDocument(analyzeDto)

      expect(service.analyzeDocument).toHaveBeenCalledWith(analyzeDto)
      expect(result).toEqual(mockRiskReport)
    })
  })

  describe("findAll", () => {
    it("should return all risk analyses", async () => {
      const reports = [mockRiskReport]
      mockRiskAnalysisService.findAll.mockResolvedValue(reports)

      const result = await controller.findAll()

      expect(service.findAll).toHaveBeenCalled()
      expect(result).toEqual(reports)
    })

    it("should return analyses by risk level when query parameter provided", async () => {
      const reports = [mockRiskReport]
      mockRiskAnalysisService.findByRiskLevel.mockResolvedValue(reports)

      const result = await controller.findAll("MEDIUM")

      expect(service.findByRiskLevel).toHaveBeenCalledWith("MEDIUM")
      expect(result).toEqual(reports)
    })
  })

  describe("findOne", () => {
    it("should return risk analysis by id", async () => {
      mockRiskAnalysisService.findOne.mockResolvedValue(mockRiskReport)

      const result = await controller.findOne("analysis-123")

      expect(service.findOne).toHaveBeenCalledWith("analysis-123")
      expect(result).toEqual(mockRiskReport)
    })
  })

  describe("findByDocumentId", () => {
    it("should return risk analysis by document id", async () => {
      mockRiskAnalysisService.findByDocumentId.mockResolvedValue(mockRiskReport)

      const result = await controller.findByDocumentId("doc-123")

      expect(service.findByDocumentId).toHaveBeenCalledWith("doc-123")
      expect(result).toEqual(mockRiskReport)
    })
  })

  describe("reanalyzeDocument", () => {
    it("should reanalyze document", async () => {
      const body = { analyzedBy: "user123", analysisMethod: "AI_ANALYSIS" }
      mockRiskAnalysisService.reanalyzeDocument.mockResolvedValue(mockRiskReport)

      const result = await controller.reanalyzeDocument("doc-123", body)

      expect(service.reanalyzeDocument).toHaveBeenCalledWith("doc-123", "user123", "AI_ANALYSIS")
      expect(result).toEqual(mockRiskReport)
    })
  })

  describe("deleteAnalysis", () => {
    it("should delete risk analysis", async () => {
      mockRiskAnalysisService.deleteAnalysis.mockResolvedValue(undefined)

      const result = await controller.deleteAnalysis("analysis-123")

      expect(service.deleteAnalysis).toHaveBeenCalledWith("analysis-123")
      expect(result).toEqual({ message: "Risk analysis deleted successfully" })
    })
  })
})
