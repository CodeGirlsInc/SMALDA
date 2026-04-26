import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../src/documents/entities/document.entity';
import { ArchiveResponseDto } from './dto/archive-response.dto';

export interface PaginatedArchivedDocuments {
  data: Document[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class DocumentArchiveService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  async archive(id: string): Promise<ArchiveResponseDto> {
    const document = await this.documentRepository.findOne({ where: { id } });

    if (!document) {
      throw new NotFoundException(`Document with id ${id} not found`);
    }

    if (document.archived) {
      return {
        id: document.id,
        title: document.title,
        archived: true,
        message: 'Document is already archived',
      };
    }

    await this.documentRepository.update(id, { archived: true });
    const updatedDocument = await this.documentRepository.findOne({ where: { id } });

    return {
      id: updatedDocument.id,
      title: updatedDocument.title,
      archived: updatedDocument.archived,
      message: 'Document archived successfully',
    };
  }

  async unarchive(id: string): Promise<ArchiveResponseDto> {
    const document = await this.documentRepository.findOne({ where: { id } });

    if (!document) {
      throw new NotFoundException(`Document with id ${id} not found`);
    }

    if (!document.archived) {
      return {
        id: document.id,
        title: document.title,
        archived: false,
        message: 'Document is not archived',
      };
    }

    await this.documentRepository.update(id, { archived: false });
    const updatedDocument = await this.documentRepository.findOne({ where: { id } });

    return {
      id: updatedDocument.id,
      title: updatedDocument.title,
      archived: updatedDocument.archived,
      message: 'Document unarchived successfully',
    };
  }

  async getArchivedDocuments(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedArchivedDocuments> {
    const queryBuilder = this.documentRepository
      .createQueryBuilder('document')
      .where('document.archived = :archived', { archived: true });

    const total = await queryBuilder.getCount();

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit).orderBy('document.createdAt', 'DESC');

    const data = await queryBuilder.getMany();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async getNonArchivedDocuments(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedArchivedDocuments> {
    const queryBuilder = this.documentRepository
      .createQueryBuilder('document')
      .where('document.archived = :archived', { archived: false });

    const total = await queryBuilder.getCount();

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit).orderBy('document.createdAt', 'DESC');

    const data = await queryBuilder.getMany();

    return {
      data,
      total,
      page,
      limit,
    };
  }
}
