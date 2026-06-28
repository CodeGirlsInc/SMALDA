import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Document, DocumentStatus } from '../documents/entities/document.entity';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Document) private readonly documentRepository: Repository<Document>,
    private readonly queueService: QueueService,
  ) {}

  async getStats() {
    const totalUsers = await this.userRepository.count();
    const totalDocuments = await this.documentRepository.count();
    const verifiedDocuments = await this.documentRepository.count({ where: { status: DocumentStatus.VERIFIED } });
    const flaggedDocuments = await this.documentRepository.count({ where: { status: DocumentStatus.FLAGGED } });
    const rejectedDocuments = await this.documentRepository.count({ where: { status: DocumentStatus.REJECTED } });
    const verificationRate = totalDocuments > 0
      ? Math.round((verifiedDocuments / totalDocuments) * 100)
      : 0;

    return {
      totalUsers,
      totalDocuments,
      verifiedDocuments,
      flaggedDocuments,
      rejectedDocuments,
      verificationRate,
    };
  }

  async getDocuments(
    page = 1,
    limit = 20,
    status?: string,
    search?: string,
  ) {
    const where: any = {};
    if (status) where.status = status;
    if (search) where.title = Like(`%${search}%`);

    const [data, total] = await this.documentRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getQueueStats() {
    return this.queueService.getQueueStats();
  }
}
