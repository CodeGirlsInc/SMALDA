import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute, DisputeStatus, ALLOWED_DISPUTE_TRANSITIONS } from './entities/dispute.entity';
import { DisputeReasonClassifierService } from './dispute-reason-classifier.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DisputeResponseDto } from './dto/dispute-response.dto';

@Injectable()
export class DisputeService {
  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,
    private readonly classifier: DisputeReasonClassifierService,
  ) {}

  async fileDispute(
    dto: CreateDisputeDto,
    userId: string,
  ): Promise<DisputeResponseDto> {
    const reason = await this.classifier.classifyDispute(dto.description);

    const dispute = this.disputeRepo.create({
      documentId: dto.documentId,
      description: dto.description,
      reason,
      filedBy: userId,
      status: DisputeStatus.OPEN,
    });

    const saved = await this.disputeRepo.save(dispute);
    return this.toResponseDto(saved);
  }

  async updateStatus(id: string, newStatus: DisputeStatus): Promise<DisputeResponseDto> {
    const dispute = await this.disputeRepo.findOne({ where: { id } });
    if (!dispute) {
      throw new NotFoundException(Dispute  not found);
    }

    const allowed = ALLOWED_DISPUTE_TRANSITIONS[dispute.status];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        Invalid status transition from '' to ''. Allowed: [],
      );
    }

    dispute.status = newStatus;
    const saved = await this.disputeRepo.save(dispute);
    return this.toResponseDto(saved);
  }

  async findByUser(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ data: DisputeResponseDto[]; total: number }> {
    const [disputes, total] = await this.disputeRepo.findAndCount({
      where: { filedBy: userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      data: disputes.map((d) => this.toResponseDto(d)),
      total,
    };
  }

  async findOne(id: string): Promise<DisputeResponseDto> {
    const dispute = await this.disputeRepo.findOne({ where: { id } });
    if (!dispute) {
      throw new NotFoundException(Dispute  not found);
    }
    return this.toResponseDto(dispute);
  }

  private toResponseDto(dispute: Dispute): DisputeResponseDto {
    return {
      id: dispute.id,
      documentId: dispute.documentId,
      description: dispute.description,
      reason: dispute.reason,
      status: dispute.status,
      filedBy: dispute.filedBy,
      createdAt: dispute.createdAt,
    };
  }
}