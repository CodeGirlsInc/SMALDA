import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Document } from '../documents/entities/document.entity';
import { VerificationRecord } from '../verification/entities/verification-record.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Document) private readonly documentRepository: Repository<Document>,
    @InjectRepository(VerificationRecord) private readonly verificationRepository: Repository<VerificationRecord>,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    await this.userRepository.update(id, updates);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.userRepository.softDelete(id);
  }

  async exportUserData(userId: string): Promise<object> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const documents = await this.documentRepository.find({ where: { ownerId: userId } });
    const verifications = await this.verificationRepository
      .createQueryBuilder('v')
      .innerJoin('v.document', 'd', 'd.ownerId = :userId', { userId })
      .getMany();

    return {
      profile: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isVerified: user.isVerified,
        preferredLanguage: user.preferredLanguage,
        createdAt: user.createdAt,
      },
      documents: documents.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        riskScore: d.riskScore,
        riskFlags: d.riskFlags,
        createdAt: d.createdAt,
      })),
      verifications: verifications.map((v) => ({
        id: v.id,
        documentId: v.documentId,
        stellarTxHash: v.stellarTxHash,
        status: v.status,
        createdAt: v.createdAt,
      })),
    };
  }

  async eraseUserData(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    await this.userRepository.update(userId, {
      email: `deleted-${userId}@anonymous`,
      passwordHash: null,
      fullName: 'Deleted User',
      isVerified: false,
    });
  }
}
