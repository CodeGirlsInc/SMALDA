import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { DocumentsService } from "./documents.service"
import { Document } from "./entities/document.entity"
import type { UploadDocumentDto } from "./dto/upload-document.dto"
import * as fs from "fs"
import type { Express } from "express"

// Mock fs module
jest.mock("fs")
const mockedFs = fs as jest.Mocked<typeof fs>

describe("DocumentsService", () => {
  let service: DocumentsService
  let repository: Repository<Document>

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  }

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: getRepositoryToken(Document),
          useValue: mockRepository,
        },
      ],
    }).compile()

    service = module.get<DocumentsService>(DocumentsService)
    repository = module.get<Repository<Document>>(getRepositoryToken(Document))

    // Reset mocks
    jest.clearAllMocks()

    // Mock fs methods
    mockedFs.existsSync.mockReturnValue(true)
    mockedFs.mkdirSync.mockReturnValue(undefined)
    mockedFs.writeFileSync.mockReturnValue(undefined)
    mockedFs.readFileSync.mockReturnValue(Buffer.from("test file content"))
    mockedFs.unlinkSync.mockReturnValue(undefined)
  })

  describe("uploadDocument", () => {
    const uploadDto: UploadDocumentDto = {
      uploadedBy: "user123",
    }

    it("should upload a document successfully", async () => {
      mockRepository.create.mockReturnValue(mockDocument)
      mockRepository.save.mockResolvedValue(mockDocument)

      const result = await service.uploadDocument(mockFile, uploadDto)

      expect(mockedFs.writeFileSync).toHaveBeenCalled()
      expect(mockRepository.create).toHaveBeenCalled()
      expect(mockRepository.save).toHaveBeenCalledWith(mockDocument)
      expect(result).toEqual(mockDocument)
    })

    it("should throw BadRequestException for invalid MIME type", async () => {
      const invalidFile = { ...mockFile, mimetype: "application/exe" }

      await expect(service.uploadDocument(invalidFile, uploadDto)).rejects.toThrow(BadRequestException)
    })

    it("should clean up file if database save fails", async () => {
      mockRepository.create.mockReturnValue(mockDocument)
      mockRepository.save.mockRejectedValue(new Error("Database error"))

      await expect(service.uploadDocument(mockFile, uploadDto)).rejects.toThrow(BadRequestException)

      expect(mockedFs.unlinkSync).toHaveBeenCalled()
    })
  })

  describe("findAll", () => {
    it("should return all documents", async () => {
      const documents = [mockDocument]
      mockRepository.find.mockResolvedValue(documents)

      const result = await service.findAll()

      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { createdAt: "DESC" },
      })
      expect(result).toEqual(documents)
    })
  })

  describe("findOne", () => {
    it("should return a document by id", async () => {
      mockRepository.findOne.mockResolvedValue(mockDocument)

      const result = await service.findOne(mockDocument.id)

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDocument.id },
      })
      expect(result).toEqual(mockDocument)
    })

    it("should throw NotFoundException if document not found", async () => {
      mockRepository.findOne.mockResolvedValue(null)

      await expect(service.findOne("non-existent-id")).rejects.toThrow(NotFoundException)
    })
  })

  describe("getFileBuffer", () => {
    it("should return file buffer and document", async () => {
      mockRepository.findOne.mockResolvedValue(mockDocument)
      const expectedBuffer = Buffer.from("test file content")

      const result = await service.getFileBuffer(mockDocument.id)

      expect(mockedFs.existsSync).toHaveBeenCalledWith(mockDocument.filePath)
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(mockDocument.filePath)
      expect(result.buffer).toEqual(expectedBuffer)
      expect(result.document).toEqual(mockDocument)
    })

    it("should throw NotFoundException if file not found on disk", async () => {
      mockRepository.findOne.mockResolvedValue(mockDocument)
      mockedFs.existsSync.mockReturnValue(false)

      await expect(service.getFileBuffer(mockDocument.id)).rejects.toThrow(NotFoundException)
    })
  })

  describe("deleteDocument", () => {
    it("should delete document and file", async () => {
      mockRepository.findOne.mockResolvedValue(mockDocument)
      mockRepository.remove.mockResolvedValue(mockDocument)

      await service.deleteDocument(mockDocument.id)

      expect(mockedFs.unlinkSync).toHaveBeenCalledWith(mockDocument.filePath)
      expect(mockRepository.remove).toHaveBeenCalledWith(mockDocument)
    })
  })

  describe("findByUploadedBy", () => {
    it("should return documents by uploadedBy", async () => {
      const documents = [mockDocument]
      mockRepository.find.mockResolvedValue(documents)

      const result = await service.findByUploadedBy("user123")

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { uploadedBy: "user123" },
        order: { createdAt: "DESC" },
      })
      expect(result).toEqual(documents)
    })
  })
})
