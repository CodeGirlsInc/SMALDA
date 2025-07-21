import { Test, type TestingModule } from "@nestjs/testing"
import { ConfigService } from "@nestjs/config"
import { ArchiveStorageService } from "./archive-storage.service"
import * as fs from "fs/promises"

jest.mock("fs/promises")
jest.mock("zlib")

describe("ArchiveStorageService", () => {
  let service: ArchiveStorageService
  let configService: ConfigService

  const mockConfigService = {
    get: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchiveStorageService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile()

    service = module.get<ArchiveStorageService>(ArchiveStorageService)
    configService = module.get<ConfigService>(ConfigService)

    // Reset mocks
    jest.clearAllMocks()
    mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        ARCHIVE_STORAGE_DIR: "./archives",
        ARCHIVE_USE_COMPRESSION: true,
        ARCHIVE_USE_EXTERNAL_STORAGE: false,
      }
      return config[key] ?? defaultValue
    })
  })

  describe("archiveDocument", () => {
    const documentId = "doc-123"
    const documentData = { id: documentId, name: "test document" }

    it("should archive document with compression", async () => {
      const mockMkdir = jest.mocked(fs.mkdir)
      const mockWriteFile = jest.mocked(fs.writeFile)

      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      // Mock zlib compression
      const zlib = require("zlib")
      const mockGzip = jest.fn().mockResolvedValue(Buffer.from("compressed"))
      zlib.gzip = jest.fn().mockImplementation((data, callback) => {
        callback(null, Buffer.from("compressed"))
      })

      const result = await service.archiveDocument(documentId, documentData, true)

      expect(mockMkdir).toHaveBeenCalledWith("./archives", { recursive: true })
      expect(mockWriteFile).toHaveBeenCalled()
      expect(result.archiveLocation).toContain(documentId)
      expect(result.originalSize).toBeGreaterThan(0)
      expect(result.compressedSize).toBeGreaterThan(0)
      expect(result.compressionRatio).toBeGreaterThan(0)
      expect(result.checksum).toBeDefined()
    })
