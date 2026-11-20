import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { Document, DocumentStatus } from './entities/document.entity';
import { User } from '../users/entities/user.entity';

const KM_PER_DEGREE_LATITUDE = 111.32;
const MIN_LATITUDE_COSINE = 1e-6;

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

  findByFileHash(fileHash: string, ownerId?: string): Promise<Document | null> {
    return this.documentRepository.findOne({
      where: Object.assign({ fileHash }, ownerId ? { ownerId } : {}),
    });
  }

  async findByOwnerPaginated(
    ownerId: string,
    page = 1,
    limit = 20,
    status?: DocumentStatus,
    search?: string,
  ): Promise<{ data: Document[]; total: number; page: number; limit: number }> {
    const where: FindOptionsWhere<Document> = { ownerId };
    if (status) where.status = status;
    if (search?.trim()) where.title = ILike(`%${search.trim()}%`);

    const [data, total] = await this.documentRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async createWithinQuota(
    payload: Partial<Document>,
    quota: number,
  ): Promise<Document> {
    const ownerId = payload.ownerId;
    if (!ownerId) {
      throw new BadRequestException('Authenticated user is required');
    }

    return this.documentRepository.manager.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({
        where: { id: ownerId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) {
        throw new BadRequestException('Authenticated user is required');
      }

      const count = await manager
        .getRepository(Document)
        .count({ where: { ownerId } });
      if (count >= quota) {
        throw new BadRequestException(
          `Upload quota exceeded. Each user may store at most ${quota} documents.`,
        );
      }

      const repository = manager.getRepository(Document);
      return repository.save(repository.create(payload));
    });
  }

  async updateStatus(
    id: string,
    status: DocumentStatus,
  ): Promise<Document | null> {
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

  async updateLocation(
    id: string,
    latitude: number,
    longitude: number,
  ): Promise<Document | null> {
    await this.documentRepository.update(id, { latitude, longitude });
    return this.findById(id);
  }

  async revokeAccess(id: string): Promise<Document | null> {
    await this.documentRepository.update(id, {
      status: DocumentStatus.REJECTED,
      archived: true,
    });
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const document = await this.documentRepository.findOne({ where: { id } });
    if (document) {
      // Remove the stored file so no orphaned blob outlives its record.
      await fs.unlink(document.filePath).catch(() => undefined);
    }
    await this.documentRepository.delete(id);
  }

  findAllWithCoordinates(): Promise<Document[]> {
    return this.documentRepository
      .createQueryBuilder('document')
      .where('document.latitude IS NOT NULL')
      .andWhere('document.longitude IS NOT NULL')
      .getMany();
  }

  findOverlapCandidates(
    latitude: number,
    longitude: number,
    radiusKm: number,
    ownerId: string,
    excludeDocumentId: string,
  ): Promise<Document[]> {
    const latDelta = radiusKm / KM_PER_DEGREE_LATITUDE;
    const minLat = Math.max(-90, latitude - latDelta);
    const maxLat = Math.min(90, latitude + latDelta);
    const maxAbsLatRadians =
      (Math.max(Math.abs(minLat), Math.abs(maxLat)) * Math.PI) / 180;
    const lonDelta = Math.min(
      180,
      radiusKm /
        (KM_PER_DEGREE_LATITUDE *
          Math.max(Math.cos(maxAbsLatRadians), MIN_LATITUDE_COSINE)),
    );

    const rawMinLon = longitude - lonDelta;
    const rawMaxLon = longitude + lonDelta;
    const longitudeRanges =
      rawMinLon < -180
        ? [
            [rawMinLon + 360, 180],
            [-180, rawMaxLon],
          ]
        : rawMaxLon > 180
          ? [
              [rawMinLon, 180],
              [-180, rawMaxLon - 360],
            ]
          : [[rawMinLon, rawMaxLon]];

    const parameters: Record<string, number | string> = {
      minLat,
      maxLat,
      ownerId,
      excludeDocumentId,
      rejectedStatus: DocumentStatus.REJECTED,
    };
    const longitudeConditions = longitudeRanges.map(([minLon, maxLon], index) => {
      parameters[`minLon${index}`] = minLon;
      parameters[`maxLon${index}`] = maxLon;
      return `document.longitude BETWEEN :minLon${index} AND :maxLon${index}`;
    });

    return this.documentRepository
      .createQueryBuilder('document')
      .where('document.latitude BETWEEN :minLat AND :maxLat')
      .andWhere(`(${longitudeConditions.join(' OR ')})`)
      .andWhere('document.owner_id != :ownerId')
      .andWhere('document.id != :excludeDocumentId')
      .andWhere('document.archived = false')
      .andWhere('document.status != :rejectedStatus')
      .setParameters(parameters)
      .getMany();
  }

  async findByRiskFilters(filters: {
    page: number;
    limit: number;
    ownerId?: string;
    minScore?: number;
    maxScore?: number;
    startDate?: Date;
    endDate?: Date;
    sortOrder: 'ASC' | 'DESC';
  }): Promise<{ data: Document[]; total: number }> {
    const qb = this.documentRepository.createQueryBuilder('document');

    qb.where('document.risk_score IS NOT NULL');

    if (filters.ownerId) {
      qb.andWhere('document.owner_id = :ownerId', {
        ownerId: filters.ownerId,
      });
    }

    if (filters.minScore !== undefined) {
      qb.andWhere('document.risk_score >= :minScore', {
        minScore: filters.minScore,
      });
    }

    if (filters.maxScore !== undefined) {
      qb.andWhere('document.risk_score <= :maxScore', {
        maxScore: filters.maxScore,
      });
    }

    if (filters.startDate) {
      qb.andWhere('document.created_at >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      qb.andWhere('document.created_at <= :endDate', {
        endDate: filters.endDate,
      });
    }

    qb.orderBy('document.risk_score', filters.sortOrder);
    qb.skip((filters.page - 1) * filters.limit);
    qb.take(filters.limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  /**
   * Documents matching `filters`, newest first. When `ownerId` is given the
   * result is restricted to that owner regardless of `filters.ownerId`, which
   * is how the non-admin exports guarantee ownership filtering.
   */
  async findFiltered(
    filters: {
      status?: DocumentStatus;
      minRisk?: number;
      maxRisk?: number;
      ownerId?: string;
      from?: string;
      to?: string;
    },
    options: { restrictToOwnerId?: string; page?: number; limit?: number } = {},
  ): Promise<{ data: Document[]; total: number }> {
    const qb = this.documentRepository.createQueryBuilder('document');
    const owner = options.restrictToOwnerId ?? filters.ownerId;
    if (owner) qb.andWhere('document.owner_id = :owner', { owner });
    if (filters.status) {
      qb.andWhere('document.status = :status', { status: filters.status });
    }
    if (filters.minRisk !== undefined) {
      qb.andWhere('document.risk_score >= :minRisk', { minRisk: filters.minRisk });
    }
    if (filters.maxRisk !== undefined) {
      qb.andWhere('document.risk_score <= :maxRisk', { maxRisk: filters.maxRisk });
    }
    if (filters.from) {
      qb.andWhere('document.created_at >= :from', { from: new Date(filters.from) });
    }
    if (filters.to) {
      qb.andWhere('document.created_at <= :to', { to: new Date(filters.to) });
    }
    qb.orderBy('document.created_at', 'DESC');
    if (options.limit) {
      qb.skip(((options.page ?? 1) - 1) * options.limit).take(options.limit);
    }
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }
}
