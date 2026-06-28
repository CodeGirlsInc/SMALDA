import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
import { AuditLog, AuditAction } from './audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async create(dto: CreateAuditLogDto): Promise<AuditLog> {
    const log = this.auditLogRepo.create({
      userId: dto.userId,
      action: dto.action as AuditAction,
      entity: dto.entity,
      entityId: dto.entityId,
      metadata: dto.metadata,
      ipAddress: dto.ipAddress,
    });
    return this.auditLogRepo.save(log);
  }

  async findAll(query: QueryAuditLogDto) {
    const { userId, action, entity, startDate, endDate, page = 1, limit = 20 } = query;
    const where: Record<string, unknown> = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entity) where.entity = Like(`%${entity}%`);
    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      where.createdAt = Between(new Date(startDate), new Date('2100-01-01'));
    } else if (endDate) {
      where.createdAt = Between(new Date('1970-01-01'), new Date(endDate));
    }

    const [data, total] = await this.auditLogRepo.findAndCount({
      where,
      take: limit,
      skip: (page - 1) * limit,
      order: { createdAt: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<AuditLog | null> {
    return this.auditLogRepo.findOne({ where: { id } });
  }
}
