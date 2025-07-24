import { Test, type TestingModule } from "@nestjs/testing"
import { OcrExtractionService } from "./ocr-extraction.service"
import { OcrExtractionController } from "./ocr-extraction.controller"
import type { OcrRequestDto, OcrResponseDto } from "./dto/ocr-extraction.dto"

describe("OcrExtractionService", () => {
  let service: OcrExtractionService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OcrExtractionService],
    }).compile()

    service = module.get<OcrExtractionService>(OcrExtractionService)
    jest.spyOn(service as any, "logger").mockImplementation(() => ({
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    }))
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  it("should return mocked text for a land-deed URL", async () => {
    const documentUrl = "http://example.com/documents/land-deed-123.pdf"
    const expectedText =
      "Extracted text from land deed: This document certifies the transfer of property located at 123 Main St. from John Doe to Jane Smith. Dated: 2023-01-15. Parcel ID: ABC-123. Legal Description: Lot 1, Block 2, Subdivision of Green Valley."
    const result = await service.extractText(documentUrl)
    expect(result).toBe(expectedText)
  })

  it("should return mocked text for a survey-plan URL", async () => {
    const documentUrl = "http://example.com/documents/survey-plan-xyz.jpg"
    const expectedText =
      "Extracted text from survey plan: Lot 42, Block B. Area: 1500 sq meters. Coordinates: (X: 100, Y: 200). Surveyed by: ABC Surveyors. Date of Survey: 2022-11-01. Bearing: N 45° E."
    const result = await service.extractText(documentUrl)
    expect(result).toBe(expectedText)
  })

  it("should return mocked text for a court-order URL", async () => {
    const documentUrl = "http://example.com/documents/court-order-001.png"
    const expectedText =
      "Extracted text from court order: Case No. 2023-CV-001. Plaintiff: Alice Brown. Defendant: Bob White. Order: The court rules in favor of the plaintiff, granting full ownership rights to the disputed land parcel. Effective Date: 2023-07-20."
    const result = await service.extractText(documentUrl)
    expect(result).toBe(expectedText)
  })

  it("should return generic mocked text for an unknown URL", async () => {
    const documentUrl = "http://example.com/documents/unknown-doc.pdf"
    const expectedText = `Extracted text from generic document: This is some sample text extracted from ${documentUrl}. It contains various details relevant to the document's content, including potential clauses and agreements. This text can be used for further AI analysis in SMALDA.`
    const result = await service.extractText(documentUrl)
    expect(result).toBe(expectedText)
  })
})

describe("OcrExtractionController", () => {
  let controller: OcrExtractionController
  let service: OcrExtractionService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OcrExtractionController],
      providers: [
        {
          provide: OcrExtractionService,
          useValue: {
            extractText: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get<OcrExtractionController>(OcrExtractionController)
    service = module.get<OcrExtractionService>(OcrExtractionService)
  })

  it("should be defined", () => {
    expect(controller).toBeDefined()
  })

  it("should call OcrExtractionService.extractText and return the result", async () => {
    const ocrRequest: OcrRequestDto = { documentUrl: "http://test.com/doc.pdf" }
    const extractedText = "Mocked extracted text."
    const expectedResponse: OcrResponseDto = { extractedText }

    jest.spyOn(service, "extractText").mockResolvedValue(extractedText)

    const result = await controller.extractText(ocrRequest)
    expect(service.extractText).toHaveBeenCalledWith(ocrRequest.documentUrl)
    expect(result).toEqual(expectedResponse)
  })
})
