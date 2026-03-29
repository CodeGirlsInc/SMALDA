import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  log(
    userId: string,
    action: AuditAction,
    resourceType: string,
    resourceId: string,
    metadata?: Record<string, unknown>,
  ): Promise<AuditLog> {
    const entry = this.repo.create({ userId, action, resourceType, resourceId, metadata: metadata ?? null });
    return this.repo.save(entry);
  }

  async findAll(page: number, limit: number): Promise<{ data: AuditLog[]; total: number }> {
    const [data, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }
}
