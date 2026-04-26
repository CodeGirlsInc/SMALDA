import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction, ResourceType } from './entities/audit-log.entity';
import { AuditLogPaginationQueryDto } from './dto/audit-log-pagination-query.dto';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async create(
    userId: string,
    action: AuditAction,
    resourceType: ResourceType,
    resourceId: string | undefined,
    ipAddress: string,
  ): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      userId,
      action,
      resourceType,
      resourceId,
      ipAddress,
    });
    return this.auditLogRepository.save(auditLog);
  }

  async findByUserId(
    userId: string,
    dto: AuditLogPaginationQueryDto,
  ): Promise<{ data: AuditLog[]; total: number }> {
    const { limit = 10, offset = 0 } = dto;

    const [data, total] = await this.auditLogRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data, total };
  }

  async findAll(
    dto: AuditLogPaginationQueryDto,
  ): Promise<{ data: AuditLog[]; total: number }> {
    const { limit = 10, offset = 0 } = dto;

    const [data, total] = await this.auditLogRepository.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data, total };
  }
}