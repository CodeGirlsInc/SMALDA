// [BE-52] Add admin dashboard statistics endpoint
import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Document, DocumentStatus } from '../documents/entities/document.entity';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('admin/stats')
@UseGuards(JwtAuthGuard)
export class AdminStatsController {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Get()
  async getDashboardStats() {
    const [
      totalUsers,
      totalDocuments,
      pendingDocuments,
      verifiedDocuments,
      flaggedDocuments,
      rejectedDocuments,
    ] = await Promise.all([
      this.userRepo.count({ where: { role: UserRole.USER } }),
      this.documentRepo.count(),
      this.documentRepo.count({ where: { status: DocumentStatus.PENDING } }),
      this.documentRepo.count({ where: { status: DocumentStatus.VERIFIED } }),
      this.documentRepo.count({ where: { status: DocumentStatus.FLAGGED } }),
      this.documentRepo.count({ where: { status: DocumentStatus.REJECTED } }),
    ]);

    return {
      users: { total: totalUsers },
      documents: {
        total: totalDocuments,
        pending: pendingDocuments,
        verified: verifiedDocuments,
        flagged: flaggedDocuments,
        rejected: rejectedDocuments,
      },
    };
  }
}
