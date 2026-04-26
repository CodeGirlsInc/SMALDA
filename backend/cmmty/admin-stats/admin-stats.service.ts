import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../src/users/entities/user.entity';
import { Document, DocumentStatus } from '../../src/documents/entities/document.entity';
import { AdminStatsDto, DocumentsByStatusCount } from './dto/admin-stats.dto';

@Injectable()
export class AdminStatsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  async getPlatformStats(): Promise<AdminStatsDto> {
    // Fetch total users efficiently
    const totalUsers = await this.userRepository.count();

    // Fetch total documents efficiently
    const totalDocuments = await this.documentRepository.count();

    // Fetch documents grouped by status
    const documentsByStatusResult = await this.documentRepository
      .createQueryBuilder('doc')
      .select('doc.status', 'status')
      .addSelect('COUNT(doc.id)', 'count')
      .groupBy('doc.status')
      .getRawMany();

    const documentsByStatus: DocumentsByStatusCount[] = documentsByStatusResult.map((result) => ({
      status: result.status as DocumentStatus,
      count: parseInt(result.count, 10),
    }));

    // Fetch average risk score (only for documents with risk score)
    const averageRiskScoreResult = await this.documentRepository
      .createQueryBuilder('doc')
      .select('AVG(doc.riskScore)', 'avgRiskScore')
      .where('doc.riskScore IS NOT NULL')
      .getRawOne();

    const averageRiskScore =
      averageRiskScoreResult?.avgRiskScore !== null
        ? parseFloat(averageRiskScoreResult?.avgRiskScore)
        : null;

    // Fetch high-risk count (score > 60)
    const highRiskCount = await this.documentRepository.count({
      where: {
        riskScore: Number ? undefined : null, // This is a placeholder, we'll use query builder
      },
    });

    // Use query builder for high-risk count with proper condition
    const highRiskResult = await this.documentRepository
      .createQueryBuilder('doc')
      .select('COUNT(doc.id)', 'count')
      .where('doc.riskScore > :riskThreshold', { riskThreshold: 60 })
      .getRawOne();

    const highRiskCountValue = parseInt(highRiskResult?.count || '0', 10);

    return {
      totalUsers,
      totalDocuments,
      documentsByStatus,
      averageRiskScore,
      highRiskCount: highRiskCountValue,
    };
  }
}
