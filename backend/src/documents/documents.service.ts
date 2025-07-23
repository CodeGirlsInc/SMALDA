import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { Document } from "./entities/document.entity"
import type { UploadDocumentDto } from "./dto/upload-document.dto"
import * as fs from "fs"
import * as path from "path"
import { v4 as uuidv4 } from "uuid"
import type { Express } from "express"

@Injectable()
export class DocumentsService {
  private readonly uploadPath = "./uploads/documents"
  private readonly allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ]

  constructor(private documentsRepository: Repository<Document>) {
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true })
    }
  }

  async uploadDocument(file: Express.Multer.File, uploadDocumentDto: UploadDocumentDto): Promise<Document> {
    // Validate MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type. Allowed types: ${this.allowedMimeTypes.join(", ")}`)
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname)
    const uniqueFilename = `${uuidv4()}${fileExtension}`
    const filePath = path.join(this.uploadPath, uniqueFilename)

    try {
      // Save file to disk
      fs.writeFileSync(filePath, file.buffer)

      // Create document entity
      const document = this.documentsRepository.create({
        name: uniqueFilename,
        originalName: file.originalname,
        filePath: filePath,
        size: file.size,
        mimeType: file.mimetype,
        uploadedBy: uploadDocumentDto.uploadedBy,
      })

      return await this.documentsRepository.save(document)
    } catch (error) {
      // Clean up file if database save fails
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      throw new BadRequestException("Failed to upload document")
    }
  }

  async findAll(): Promise<Document[]> {
    return await this.documentsRepository.find({
      order: { createdAt: "DESC" },
    })
  }

  async findOne(id: string): Promise<Document> {
    const document = await this.documentsRepository.findOne({
      where: { id },
    })

    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found`)
    }

    return document
  }

  async getFileBuffer(id: string): Promise<{ buffer: Buffer; document: Document }> {
    const document = await this.findOne(id)

    if (!fs.existsSync(document.filePath)) {
      throw new NotFoundException("File not found on disk")
    }

    const buffer = fs.readFileSync(document.filePath)
    return { buffer, document }
  }

  async deleteDocument(id: string): Promise<void> {
    const document = await this.findOne(id)

    // Delete file from disk
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath)
    }

    // Delete from database
    await this.documentsRepository.remove(document)
  }

  async findByUploadedBy(uploadedBy: string): Promise<Document[]> {
    return await this.documentsRepository.find({
      where: { uploadedBy },
      order: { createdAt: "DESC" },
    })
  }
}
