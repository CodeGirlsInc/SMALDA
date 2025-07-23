import { Test, type TestingModule } from "@nestjs/testing"
import type { Response } from "express"
import { DocumentsController } from "./documents.controller"
import { DocumentsService } from "./documents.service"
import type { UploadDocumentDto } from "./dto/upload-document.dto"
import type { Document } from "./entities/document.entity"
import type { Express } from "express"
import { jest } from "@jest/globals"

describe("DocumentsController", () => {
  let controller: DocumentsController
  let service: DocumentsService

  const mockDocument: Document = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "test-file.pdf",
    originalName: "original-test-file.pdf",
    filePath: "./uploads/documents/test-file.pdf",
    size: 1024,
    mimeType: "application/pdf",
    uploadedBy: "user123",
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockFile: Express.Multer.File = {
    fieldname: "file",
    originalname: "test-document.pdf",
    encoding: "7bit",
    mimetype: "application/pdf",
    size: 1024,
    buffer: Buffer.from("test file content"),
    destination: "",
    filename: "",
    path: "",
    stream: null,
  }

  const mockDocumentsService = {
    uploadDocument: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    getFileBuffer: jest.fn(),
    deleteDocument: jest.fn(),
    findByUploadedBy: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        {
          provide: DocumentsService,
          useValue: mockDocumentsService,
        },
      ],
    }).compile()

    controller = module.get<DocumentsController>(DocumentsController)
    service = module.get<DocumentsService>(DocumentsService)

    jest.clearAllMocks()
  })

  describe("uploadDocument", () => {
    it("should upload a document", async () => {
      const uploadDto: UploadDocumentDto = { uploadedBy: "user123" }
      mockDocumentsService.uploadDocument.mockResolvedValue(mockDocument)

      const result = await controller.uploadDocument(mockFile, uploadDto)

      expect(service.uploadDocument).toHaveBeenCalledWith(mockFile, uploadDto)
      expect(result).toEqual(mockDocument)
    })
  })

  describe("findAll", () => {
    it("should return all documents", async () => {
      const documents = [mockDocument]
      mockDocumentsService.findAll.mockResolvedValue(documents)

      const result = await controller.findAll()

      expect(service.findAll).toHaveBeenCalled()
      expect(result).toEqual(documents)
    })

    it("should return documents by uploadedBy when query parameter provided", async () => {
      const documents = [mockDocument]
      mockDocumentsService.findByUploadedBy.mockResolvedValue(documents)

      const result = await controller.findAll("user123")

      expect(service.findByUploadedBy).toHaveBeenCalledWith("user123")
      expect(result).toEqual(documents)
    })
  })

  describe("findOne", () => {
    it("should return a document by id", async () => {
      mockDocumentsService.findOne.mockResolvedValue(mockDocument)

      const result = await controller.findOne(mockDocument.id)

      expect(service.findOne).toHaveBeenCalledWith(mockDocument.id)
      expect(result).toEqual(mockDocument)
    })
  })

  describe("downloadDocument", () => {
    it("should download a document", async () => {
      const mockResponse = {
        set: jest.fn(),
        send: jest.fn(),
      } as unknown as Response

      const buffer = Buffer.from("test file content")
      mockDocumentsService.getFileBuffer.mockResolvedValue({
        buffer,
        document: mockDocument,
      })

      await controller.downloadDocument(mockDocument.id, mockResponse)

      expect(service.getFileBuffer).toHaveBeenCalledWith(mockDocument.id)
      expect(mockResponse.set).toHaveBeenCalledWith({
        "Content-Type": mockDocument.mimeType,
        "Content-Disposition": `attachment; filename="${mockDocument.originalName}"`,
        "Content-Length": mockDocument.size.toString(),
      })
      expect(mockResponse.send).toHaveBeenCalledWith(buffer)
    })
  })

  describe("viewDocument", () => {
    it("should view a document", async () => {
      const mockResponse = {
        set: jest.fn(),
        send: jest.fn(),
      } as unknown as Response

      const buffer = Buffer.from("test file content")
      mockDocumentsService.getFileBuffer.mockResolvedValue({
        buffer,
        document: mockDocument,
      })

      await controller.viewDocument(mockDocument.id, mockResponse)

      expect(service.getFileBuffer).toHaveBeenCalledWith(mockDocument.id)
      expect(mockResponse.set).toHaveBeenCalledWith({
        "Content-Type": mockDocument.mimeType,
        "Content-Length": mockDocument.size.toString(),
      })
      expect(mockResponse.send).toHaveBeenCalledWith(buffer)
    })
  })

  describe("deleteDocument", () => {
    it("should delete a document", async () => {
      mockDocumentsService.deleteDocument.mockResolvedValue(undefined)

      const result = await controller.deleteDocument(mockDocument.id)

      expect(service.deleteDocument).toHaveBeenCalledWith(mockDocument.id)
      expect(result).toEqual({ message: "Document deleted successfully" })
    })
  })
})
