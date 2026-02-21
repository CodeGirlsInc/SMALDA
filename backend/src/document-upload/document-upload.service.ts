import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { unlinkSync } from 'fs';
import { UploadedDocument } from './entities/uploaded-document.entity';

@Injectable()
export class DocumentUploadService {
  constructor(
    @InjectRepository(UploadedDocument)
    private readonly uploadedDocumentRepository: Repository<UploadedDocument>,
  ) {}

  async saveUpload(file: Express.Multer.File): Promise<UploadedDocument> {
    const document = this.uploadedDocumentRepository.create({
      originalName: file.originalname,
      storagePath: file.path,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });

    return this.uploadedDocumentRepository.save(document);
  }

  async findById(id: string): Promise<UploadedDocument> {
    const document = await this.uploadedDocumentRepository.findOne({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID "${id}" not found`);
    }

    return document;
  }

  async deleteUpload(id: string): Promise<void> {
    const document = await this.findById(id);

    try {
      unlinkSync(document.storagePath);
    } catch {
      // File may have already been removed from disk; proceed to clean up DB record
      throw new InternalServerErrorException(
        `Failed to delete file at path "${document.storagePath}"`,
      );
    }

    await this.uploadedDocumentRepository.remove(document);
  }
}
