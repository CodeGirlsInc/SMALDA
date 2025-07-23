import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { RiskAnalysisService } from "./risk-analysis.service"
import { RiskAnalysis, RiskLevel } from "./entities/risk-analysis.entity"
import { DocumentsService } from "../documents/documents.service"
import { StaticRulesAnalyzer } from "./analyzers/static-rules.analyzer"
import { AiMockAnalyzer } from "./analyzers/ai-mock.analyzer"
import type { AnalyzeDocumentDto } from "./dto/analyze-document.dto"
import type { Document } from "../documents/entities/document.entity"
import * as fs from "fs"
import jest from "jest" // Import jest to declare the variable

// Mock fs and pdf-parse
jest.mock("fs")
jest.mock("pdf-parse")

const mockedFs = fs as jest.Mocked<typeof fs>

describe("RiskAnalysisService", () => {
  let service: RiskAnalysisService
  let repository: Repository<RiskAnalysis>
  let documentsService: DocumentsService

  const mockDocument: Document = {
    id: "doc-123",
    name: "test-document.pdf",
    originalName: "land-deed.pdf",
    filePath: "./uploads/documents/test-document.pdf",
    size: 1024,
    mimeType: "application/pdf",
    uploadedBy: "user123",
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockRiskAnalysis: RiskAnalysis = {
    id: "analysis-123",
    documentId: "doc-123",
    document: mockDocument,
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

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  }

  const mockDocumentsService = {
    findOne: jest.fn(),
  }

  const mockStaticRulesAnalyzer = {
    analyzeDocument: jest.fn(),
  }

  const mockAiMockAnalyzer = {
    analyzeDocument: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskAnalysisService,
        {
          provide: getRepositoryToken(RiskAnalysis),
          useValue: mockRepository,
        },
        {
          provide: DocumentsService,
          useValue: mockDocumentsService,
        },
        {
          provide: StaticRulesAnalyzer,
          useValue: mockStaticRulesAnalyzer,
        },
        {
          provide: AiMockAnalyzer,
          useValue: mockAiMockAnalyzer,
        },
      ],
    }).compile()

    service = module.get<RiskAnalysisService>(RiskAnalysisService)
    repository = module.get<Repository<RiskAnalysis>>(getRepositoryToken(RiskAnalysis))
    documentsService = module.get<DocumentsService>(DocumentsService)

    jest.clearAllMocks()

    // Mock fs methods
    mockedFs.existsSync.mockReturnValue(true)
    mockedFs.readFileSync.mockReturnValue(Buffer.from("test document content with dispute and incomplete sections"))
  })

  describe("analyzeDocument", () => {
    const analyzeDto: AnalyzeDocumentDto = {
      documentId: "doc-123",
      analyzedBy: "user123",
      analysisMethod: "STATIC_RULES" as any,
    }

    it("should analyze document successfully", async () => {
      mockDocumentsService.findOne.mockResolvedValue(mockDocument)
      mockRepository.findOne.mockResolvedValue(null) // No existing analysis
      mockStaticRulesAnalyzer.analyzeDocument.mockResolvedValue({
        riskLevel: RiskLevel.MEDIUM,
        summary: "Medium risk detected",
        detectedKeywords: ["dispute", "incomplete"],
        riskFactors: mockRiskAnalysis.riskFactors,
        riskScore: 20,
      })
      mockRepository.create.mockReturnValue(mockRiskAnalysis)
      mockRepository.save.mockResolvedValue(mockRiskAnalysis)

      const result = await service.analyzeDocument(analyzeDto)

      expect(documentsService.findOne).toHaveBeenCalledWith("doc-123")
      expect(mockStaticRulesAnalyzer.analyzeDocument).toHaveBeenCalled()
      expect(repository.save).toHaveBeenCalled()
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM)
      expect(result.detectedKeywords).toContain("dispute")
    })

    it("should throw BadRequestException if document already analyzed", async () => {
      mockDocumentsService.findOne.mockResolvedValue(mockDocument)
      mockRepository.findOne.mockResolvedValue(mockRiskAnalysis) // Existing analysis

      await expect(service.analyzeDocument(analyzeDto)).rejects.toThrow(BadRequestException)
    })

    it("should throw BadRequestException for unsupported analysis method", async () => {
      const invalidDto = { ...analyzeDto, analysisMethod: "INVALID_METHOD" as any }
      mockDocumentsService.findOne.mockResolvedValue(mockDocument)
      mockRepository.findOne.mockResolvedValue(null)

      await expect(service.analyzeDocument(invalidDto)).rejects.toThrow(BadRequestException)
    })
  })

  describe("findAll", () => {
    it("should return all risk analyses", async () => {
      const analyses = [mockRiskAnalysis]
      mockRepository.find.mockResolvedValue(analyses)

      const result = await service.findAll()

      expect(repository.find).toHaveBeenCalledWith({
        order: { createdAt: "DESC" },
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(mockRiskAnalysis.id)
    })
  })

  describe("findOne", () => {
    it("should return risk analysis by id", async () => {
      mockRepository.findOne.mockResolvedValue(mockRiskAnalysis)

      const result = await service.findOne("analysis-123")

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: "analysis-123" },
        relations: ["document"],
      })
      expect(result.id).toBe(mockRiskAnalysis.id)
    })

    it("should throw NotFoundException if analysis not found", async () => {
      mockRepository.findOne.mockResolvedValue(null)

      await expect(service.findOne("non-existent")).rejects.toThrow(NotFoundException)
    })
  })

  describe("findByDocumentId", () => {
    it("should return risk analysis by document id", async () => {
      mockRepository.findOne.mockResolvedValue(mockRiskAnalysis)

      const result = await service.findByDocumentId("doc-123")

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { documentId: "doc-123" },
        relations: ["document"],
      })
      expect(result.documentId).toBe("doc-123")
    })
  })

  describe("findByRiskLevel", () => {
    it("should return analyses by risk level", async () => {
      const analyses = [mockRiskAnalysis]
      mockRepository.find.mockResolvedValue(analyses)

      const result = await service.findByRiskLevel("MEDIUM")

      expect(repository.find).toHaveBeenCalledWith({
        where: { riskLevel: "MEDIUM" },
        order: { createdAt: "DESC" },
      })
      expect(result).toHaveLength(1)
    })
  })

  describe("reanalyzeDocument", () => {
    it("should delete existing analysis and create new one", async () => {
      mockRepository.findOne
        .mockResolvedValueOnce(mockRiskAnalysis) // For deletion
        .mockResolvedValueOnce(null) // For new analysis check
      mockRepository.remove.mockResolvedValue(mockRiskAnalysis)
      mockDocumentsService.findOne.mockResolvedValue(mockDocument)
      mockStaticRulesAnalyzer.analyzeDocument.mockResolvedValue({
        riskLevel: RiskLevel.LOW,
        summary: "Low risk detected",
        detectedKeywords: [],
        riskFactors: [],
        riskScore: 5,
      })
      mockRepository.create.mockReturnValue({ ...mockRiskAnalysis, riskLevel: RiskLevel.LOW })
      mockRepository.save.mockResolvedValue({ ...mockRiskAnalysis, riskLevel: RiskLevel.LOW })

      const result = await service.reanalyzeDocument("doc-123", "user123")

      expect(repository.remove).toHaveBeenCalledWith(mockRiskAnalysis)
      expect(result.riskLevel).toBe(RiskLevel.LOW)
    })
  })
})
