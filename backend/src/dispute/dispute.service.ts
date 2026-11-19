import {
  BadRequestException,
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Dispute, DisputeStatus, ALLOWED_DISPUTE_TRANSITIONS } from './entities/dispute.entity';
import { DisputeReasonClassifierService } from './dispute-reason-classifier.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DisputeResponseDto } from './dto/dispute-response.dto';
import { AccessLogsService } from '../access-logs/access-logs.service';

@Injectable()
export class DisputeService {
  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,
    private readonly classifier: DisputeReasonClassifierService,
    private readonly accessLogsService: AccessLogsService,
  ) {}

  async fileDispute(
    dto: CreateDisputeDto,
    userId: string,
  ): Promise<DisputeResponseDto> {
    const existing = await this.findActiveDispute(dto.documentId, userId);
    if (existing) {
      throw this.activeDisputeConflict(existing);
    }

    const reason = await this.classifier.classifyDispute(dto.description);

    const dispute = this.disputeRepo.create({
      documentId: dto.documentId,
      description: dto.description,
      reason,
      filedBy: userId,
      status: DisputeStatus.OPEN,
    });

    let saved: Dispute;
    try {
      saved = await this.disputeRepo.save(dispute);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const concurrentDispute = await this.findActiveDispute(
          dto.documentId,
          userId,
        );
        if (concurrentDispute) {
          throw this.activeDisputeConflict(concurrentDispute);
        }
      }
      throw error;
    }

    await this.accessLogsService.logDocumentAccess(
      dto.documentId,
      `dispute_filed:${DisputeStatus.OPEN}`,
      userId,
    );

    return this.toResponseDto(saved);
  }

  private findActiveDispute(
    documentId: string,
    filedBy: string,
  ): Promise<Dispute | null> {
    return this.disputeRepo.findOne({
      where: {
        documentId,
        filedBy,
        status: In([DisputeStatus.OPEN, DisputeStatus.IN_REVIEW]),
      },
      order: { createdAt: 'DESC' },
    });
  }

  private activeDisputeConflict(dispute: Dispute): ConflictException {
    return new ConflictException({
      message: 'An open dispute already exists for this document',
      disputeId: dispute.id,
      existingDisputeId: dispute.id,
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;

    const candidate = error as {
      code?: unknown;
      driverError?: { code?: unknown };
    };
    return (
      candidate.code === '23505' || candidate.driverError?.code === '23505'
    );
  }

  async updateStatus(
    id: string,
    newStatus: DisputeStatus,
    userId: string,
  ): Promise<DisputeResponseDto> {
    const dispute = await this.disputeRepo.findOne({ where: { id } });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }

    const allowed = ALLOWED_DISPUTE_TRANSITIONS[dispute.status];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from '${dispute.status}' to '${newStatus}'. Allowed: [${allowed.join(', ')}]`,
      );
    }

    const oldStatus = dispute.status;
    dispute.status = newStatus;
    await this.disputeRepo.save(dispute);

    await this.accessLogsService.logDocumentAccess(
      dispute.documentId,
      `dispute_status_changed:${oldStatus}->${newStatus}`,
      userId,
    );

    return this.toResponseDto(dispute);
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

  async findOne(
    id: string,
    userId: string,
    allowAdmin = false,
  ): Promise<DisputeResponseDto> {
    const dispute = await this.disputeRepo.findOne({ where: { id } });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }
    if (dispute.filedBy !== userId && !allowAdmin) {
      throw new ForbiddenException('Forbidden access');
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
