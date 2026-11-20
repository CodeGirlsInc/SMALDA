import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  Optional,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Dispute,
  DisputeResolution,
  DisputeStatus,
  ALLOWED_DISPUTE_TRANSITIONS,
} from './entities/dispute.entity';
import { DisputeReasonClassifierService } from './dispute-reason-classifier.service';
import { canTransition } from './dispute-status.state-machine';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DisputeResponseDto } from './dto/dispute-response.dto';
import { ReassignDisputeDto } from './dto/reassign-dispute.dto';
import { AccessLogsService } from '../access-logs/access-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class DisputeService {
  private readonly logger = new Logger(DisputeService.name);

  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,
    private readonly classifier: DisputeReasonClassifierService,
    private readonly accessLogsService: AccessLogsService,
    @Optional() private readonly notificationsService?: NotificationsService,
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
      'dispute_filed',
      userId,
      undefined,
      undefined,
      false,
      { status: DisputeStatus.OPEN },
    );

    await this.notify(
      userId,
      'Dispute filed',
      `Your dispute for document ${dto.documentId} was filed.`,
      dto.documentId,
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
    resolution?: DisputeResolution,
    resolutionNote?: string,
  ): Promise<DisputeResponseDto> {
    const dispute = await this.disputeRepo.findOne({ where: { id } });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }

    const allowed = ALLOWED_DISPUTE_TRANSITIONS[dispute.status];
    if (!canTransition(dispute.status, newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from '${dispute.status}' to '${newStatus}'. Allowed: [${allowed.join(', ')}]`,
      );
    }

    const oldStatus = dispute.status;
    dispute.status = newStatus;
    if (newStatus === DisputeStatus.RESOLVED) {
      if (resolution) {
        dispute.resolution = resolution;
      }
      if (resolutionNote !== undefined) {
        dispute.resolutionNote = resolutionNote;
      }
    }
    await this.disputeRepo.save(dispute);

    await this.accessLogsService.logDocumentAccess(
      dispute.documentId,
      'dispute_status_changed',
      userId,
      undefined,
      undefined,
      false,
      { from: oldStatus, to: newStatus },
    );

    return this.toResponseDto(dispute);
  }

  async withdraw(id: string, userId: string): Promise<DisputeResponseDto> {
    const dispute = await this.disputeRepo.findOne({ where: { id } });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }
    if (dispute.filedBy !== userId) {
      throw new ForbiddenException('Only the filer can withdraw a dispute');
    }
    if (dispute.status !== DisputeStatus.OPEN) {
      throw new BadRequestException(
        `Only open disputes can be withdrawn (current status: '${dispute.status}')`,
      );
    }

    dispute.status = DisputeStatus.DISMISSED;
    dispute.resolution = DisputeResolution.WITHDRAWN;
    await this.disputeRepo.save(dispute);

    await this.accessLogsService.logDocumentAccess(
      dispute.documentId,
      `dispute_withdrawn:${DisputeStatus.DISMISSED}`,
      userId,
    );

    return this.toResponseDto(dispute);
  }

  async reassign(
    id: string,
    dto: ReassignDisputeDto,
    userId: string,
  ): Promise<DisputeResponseDto> {
    const dispute = await this.disputeRepo.findOne({ where: { id } });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }

    dispute.reviewerId = dto.newReviewerId;
    await this.disputeRepo.save(dispute);

    await this.accessLogsService.logDocumentAccess(
      dispute.documentId,
      `dispute_reassigned:${dto.newReviewerId}${dto.reason ? `:${dto.reason}` : ''}`,
      userId,
    );

    await this.notify(
      dispute.filedBy,
      `Dispute ${newStatus}`,
      `Your dispute for document ${dispute.documentId} is now ${newStatus}.`,
      dispute.documentId,
    );

    return this.toResponseDto(dispute);
  }

  async findByUser(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    data: DisputeResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [disputes, total] = await this.disputeRepo.findAndCount({
      where: { filedBy: userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      data: disputes.map((d) => this.toResponseDto(d)),
      total,
      page,
      limit,
    };
  }

  async findAll(
    page = 1,
    limit = 20,
    status?: DisputeStatus,
  ): Promise<{
    data: DisputeResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [disputes, total] = await this.disputeRepo.findAndCount({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      data: disputes.map((d) => this.toResponseDto(d)),
      total,
      page,
      limit,
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

  private async notify(
    userId: string,
    title: string,
    body: string,
    documentId: string,
  ): Promise<void> {
    if (!this.notificationsService || !userId) return;
    try {
      await this.notificationsService.create(
        userId,
        NotificationType.DISPUTE_UPDATE,
        title,
        body,
        documentId,
      );
    } catch (error) {
      this.logger.warn(
        `Could not persist dispute notification for ${documentId}: ${error?.message}`,
      );
    }
  }

  private toResponseDto(dispute: Dispute): DisputeResponseDto {
    return {
      id: dispute.id,
      documentId: dispute.documentId,
      description: dispute.description,
      reason: dispute.reason,
      status: dispute.status,
      filedBy: dispute.filedBy,
      reviewerId: dispute.reviewerId ?? null,
      resolution: dispute.resolution ?? null,
      resolutionNote: dispute.resolutionNote ?? null,
      createdAt: dispute.createdAt,
    };
  }
}
