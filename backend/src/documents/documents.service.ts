import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentStatus } from './entities/document.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResultDto } from '../common/dto/paginated-result.dto';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  create(payload: Partial<Document>): Promise<Document> {
    const document = this.documentRepository.create(payload);
    return this.documentRepository.save(document);
  }

  findById(id: string): Promise<Document | null> {
    return this.documentRepository.findOne({ where: { id } });
  }

  findByOwner(ownerId: string): Promise<Document[]> {
    return this.documentRepository.find({ where: { ownerId } });
  }

  findByFileHash(fileHash: string): Promise<Document | null> {
    return this.documentRepository.findOne({ where: { fileHash } });
  }

  async updateStatus(id: string, status: DocumentStatus): Promise<Document | null> {
    await this.documentRepository.update(id, { status });
    return this.findById(id);
  }

  async updateRisk(
    id: string,
    score: number,
    flags: string[],
  ): Promise<Document | null> {
    await this.documentRepository.update(id, {
      riskScore: score,
      riskFlags: flags,
    });
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.documentRepository.delete(id);
  }

  async findByOwnerPaginated(
    ownerId: string,
    dto: PaginationDto,
  ): Promise<PaginatedResultDto<Document>> {
    const page = dto.page || 1;
    const limit = dto.limit || 10;
    const sortColumn = dto.sortBy || 'createdAt';
    const sortDirection = dto.sortOrder || 'DESC';

    const [data, total] = await this.documentRepository.findAndCount({
      where: { ownerId },
      order: { [sortColumn]: sortDirection },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResultDto(data, total, page, limit);
  }
}
