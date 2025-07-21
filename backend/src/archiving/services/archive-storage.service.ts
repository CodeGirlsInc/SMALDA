import { Injectable, Logger } from "@nestjs/common"
import type { ConfigService } from "@nestjs/config"
import * as fs from "fs/promises"
import * as path from "path"
import * as zlib from "zlib"
import { promisify } from "util"

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

export interface ArchiveStorageResult {
  archiveLocation: string
  originalSize: number
  compressedSize: number
  compressionRatio: number
  checksum: string
}

@Injectable()
export class ArchiveStorageService {
  private readonly logger = new Logger(ArchiveStorageService.name)
  private readonly archiveDir: string
  private readonly useCompression: boolean
  private readonly useExternalStorage: boolean

  constructor(private configService: ConfigService) {
    this.archiveDir = this.configService.get<string>("ARCHIVE_STORAGE_DIR", "./archives")
    this.useCompression = this.configService.get<boolean>("ARCHIVE_USE_COMPRESSION", true)
    this.useExternalStorage = this.configService.get<boolean>("ARCHIVE_USE_EXTERNAL_STORAGE", false)
  }

  async archiveDocument(
    documentId: string,
    documentData: Record<string, any>,
    compress = true,
  ): Promise<ArchiveStorageResult> {
    this.logger.log(`Archiving document: ${documentId}`)

    try {
      // Ensure archive directory exists
      await fs.mkdir(this.archiveDir, { recursive: true })

      // Serialize document data
      const serializedData = JSON.stringify(documentData)
      const originalBuffer = Buffer.from(serializedData, "utf8")
      const originalSize = originalBuffer.length

      let finalBuffer = originalBuffer
      let compressedSize = originalSize
      let compressionRatio = 1

      // Compress if enabled
      if (compress && this.useCompression) {
        finalBuffer = await gzip(originalBuffer)
        compressedSize = finalBuffer.length
        compressionRatio = originalSize / compressedSize
      }

      // Generate archive location
      const timestamp = new Date().toISOString().split("T")[0]
      const archiveFileName = `${documentId}_${timestamp}${compress ? ".gz" : ".json"}`
      const archiveLocation = path.join(this.archiveDir, archiveFileName)

      // Store the archived data
      await fs.writeFile(archiveLocation, finalBuffer)

      // Generate checksum
      const checksum = this.generateChecksum(finalBuffer)

      this.logger.log(
        `Document archived successfully: ${documentId}, compression ratio: ${compressionRatio.toFixed(2)}`,
      )

      return {
        archiveLocation,
        originalSize,
        compressedSize,
        compressionRatio,
        checksum,
      }
    } catch (error) {
      this.logger.error(`Failed to archive document ${documentId}: ${error.message}`, error.stack)
      throw new Error(`Archive operation failed: ${error.message}`)
    }
  }

  async restoreDocument(archiveLocation: string, isCompressed = true): Promise<Record<string, any>> {
    this.logger.log(`Restoring document from: ${archiveLocation}`)

    try {
      // Read archived data
      const archivedBuffer = await fs.readFile(archiveLocation)

      let restoredBuffer = archivedBuffer

      // Decompress if needed
      if (isCompressed && this.useCompression) {
        restoredBuffer = await gunzip(archivedBuffer)
      }

      // Parse document data
      const documentData = JSON.parse(restoredBuffer.toString("utf8"))

      this.logger.log(`Document restored successfully from: ${archiveLocation}`)
      return documentData
    } catch (error) {
      this.logger.error(`Failed to restore document from ${archiveLocation}: ${error.message}`, error.stack)
      throw new Error(`Restore operation failed: ${error.message}`)
    }
  }

  async deleteArchivedDocument(archiveLocation: string): Promise<void> {
    try {
      await fs.unlink(archiveLocation)
      this.logger.log(`Archived document deleted: ${archiveLocation}`)
    } catch (error) {
      this.logger.error(`Failed to delete archived document ${archiveLocation}: ${error.message}`)
      throw new Error(`Delete operation failed: ${error.message}`)
    }
  }

  async getArchiveInfo(archiveLocation: string): Promise<{ size: number; exists: boolean; lastModified: Date }> {
    try {
      const stats = await fs.stat(archiveLocation)
      return {
        size: stats.size,
        exists: true,
        lastModified: stats.mtime,
      }
    } catch (error) {
      return {
        size: 0,
        exists: false,
        lastModified: new Date(),
      }
    }
  }

  async getStorageStats(): Promise<{
    totalArchives: number
    totalSize: number
    averageCompressionRatio: number
  }> {
    try {
      const files = await fs.readdir(this.archiveDir)
      let totalSize = 0
      let totalArchives = 0

      for (const file of files) {
        const filePath = path.join(this.archiveDir, file)
        const stats = await fs.stat(filePath)
        totalSize += stats.size
        totalArchives++
      }

      return {
        totalArchives,
        totalSize,
        averageCompressionRatio: 2.5, // Mock average compression ratio
      }
    } catch (error) {
      this.logger.error(`Failed to get storage stats: ${error.message}`)
      return {
        totalArchives: 0,
        totalSize: 0,
        averageCompressionRatio: 1,
      }
    }
  }

  private generateChecksum(buffer: Buffer): string {
    const crypto = require("crypto")
    return crypto.createHash("sha256").update(buffer).digest("hex")
  }

  // Mock external storage methods (replace with actual cloud storage implementation)
  async uploadToExternalStorage(documentId: string, buffer: Buffer): Promise<{ location: string; size: number }> {
    // Mock implementation - replace with actual cloud storage (AWS S3, Google Cloud, etc.)
    await new Promise((resolve) => setTimeout(resolve, 100))

    const mockLocation = `s3://archive-bucket/documents/${documentId}`
    this.logger.log(`Document uploaded to external storage: ${mockLocation}`)

    return {
      location: mockLocation,
      size: buffer.length,
    }
  }

  async downloadFromExternalStorage(location: string): Promise<Buffer> {
    // Mock implementation - replace with actual cloud storage download
    await new Promise((resolve) => setTimeout(resolve, 100))

    this.logger.log(`Document downloaded from external storage: ${location}`)
    return Buffer.from("mock document data")
  }
}
