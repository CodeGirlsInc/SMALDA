import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, Raw } from 'typeorm';
import { createHash } from 'crypto';
import { Document, DocumentStatus } from './entities/document.entity';
import { SearchDocumentsDto } from './dto/search-documents.dto';
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

  async search(dto: SearchDocumentsDto): Promise<PaginatedResultDto<Document>> {
    const { query, ownerId, status, mimeType, minRiskScore, maxRiskScore, archived, startDate, endDate, page, limit, sortBy, sortOrder } = dto;

    const qb = this.documentRepository.createQueryBuilder('doc');

    if (query) {
      qb.andWhere(
        '(doc.title ILIKE :query OR doc.fileHash ILIKE :query OR doc.mimeType ILIKE :query)',
        { query: `%${query}%` },
      );
    }

    if (ownerId) qb.andWhere('doc.ownerId = :ownerId', { ownerId });
    if (status) qb.andWhere('doc.status = :status', { status });
    if (mimeType) qb.andWhere('doc.mimeType = :mimeType', { mimeType });
    if (minRiskScore !== undefined) qb.andWhere('doc.riskScore >= :minRiskScore', { minRiskScore });
    if (maxRiskScore !== undefined) qb.andWhere('doc.riskScore <= :maxRiskScore', { maxRiskScore });
    if (archived !== undefined) qb.andWhere('doc.archived = :archived', { archived });
    if (startDate) qb.andWhere('doc.createdAt >= :startDate', { startDate: new Date(startDate) });
    if (endDate) qb.andWhere('doc.createdAt <= :endDate', { endDate: new Date(endDate) });

    const sortColumn = sortBy || 'createdAt';
    const sortDirection = sortOrder || 'DESC';
    qb.orderBy(`doc.${sortColumn}`, sortDirection);

    const pageNum = page || 1;
    const limitNum = limit || 10;
    qb.skip((pageNum - 1) * limitNum).take(limitNum);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, pageNum, limitNum);
  }

  async bulkCreate(files: Express.Multer.File[], ownerId: string): Promise<Document[]> {
    const documents: Document[] = [];

    for (const file of files) {
      const fileHash = createHash('sha256').update(file.buffer).digest('hex');
      const existing = await this.findByFileHash(fileHash);
      if (existing) {
        documents.push(existing);
        continue;
      }

      const doc = this.documentRepository.create({
        ownerId,
        title: file.originalname,
        filePath: fileHash,
        fileHash,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: DocumentStatus.PENDING,
      });

      documents.push(await this.documentRepository.save(doc));
    }

    return documents;
  }
}
