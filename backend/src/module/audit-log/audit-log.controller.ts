import { Column, Controller, CreateDateColumn, Entity, Get, Injectable, PrimaryGeneratedColumn, Query, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User, UserRole } from '../../users/entities/user.entity';
import { ForbiddenException } from '@nestjs/common';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ nullable: true }) userId: string;
  @Column() action: string;
  @Column() resourceType: string;
  @Column({ nullable: true }) resourceId: string;
  @Column({ type: 'json', nullable: true }) metadata: Record<string, unknown>;
  @CreateDateColumn() createdAt: Date;
}

@Injectable()
export class AuditLogService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async log(userId: string, action: string, resourceType: string, resourceId: string, metadata?: Record<string, unknown>) {
    return this.repo.save(this.repo.create({ userId, action, resourceType, resourceId, metadata }));
  }
}

@Controller('module/audit')
@UseGuards(JwtAuthGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService, @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  @Get()
  async list(@Req() req: { user: User }, @Query('page') page = '1', @Query('limit') limit = '20') {
    if (req.user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, parseInt(limit, 10));
    const [data, total] = await this.repo.findAndCount({ order: { createdAt: 'DESC' }, skip: (p - 1) * l, take: l });
    return { data, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }
}