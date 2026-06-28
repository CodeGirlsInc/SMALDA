import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute, DisputeStatus } from './entities/dispute.entity';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

@Injectable()
export class DisputeService {
  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepository: Repository<Dispute>,
  ) {}

  create(userId: string, dto: CreateDisputeDto): Promise<Dispute> {
    const dispute = this.disputeRepository.create({
      raisedById: userId,
      documentId: dto.documentId,
      reason: dto.reason,
      description: dto.description,
    });
    return this.disputeRepository.save(dispute);
  }

  findById(id: string): Promise<Dispute | null> {
    return this.disputeRepository.findOne({
      where: { id },
      relations: ['raisedBy', 'document'],
    });
  }

  findByDocument(documentId: string): Promise<Dispute[]> {
    return this.disputeRepository.find({
      where: { documentId },
      relations: ['raisedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  findByUser(userId: string): Promise<Dispute[]> {
    return this.disputeRepository.find({
      where: { raisedById: userId },
      relations: ['document'],
      order: { createdAt: 'DESC' },
    });
  }

  async resolve(
    id: string,
    dto: ResolveDisputeDto,
    resolvedById: string,
  ): Promise<Dispute> {
    const dispute = await this.findById(id);
    if (!dispute) throw new NotFoundException('Dispute not found');

    await this.disputeRepository.update(id, {
      status: dto.status,
      resolutionAction: dto.action,
      resolutionNote: dto.note,
      resolvedById,
    });

    return this.findById(id) as Promise<Dispute>;
  }
}
