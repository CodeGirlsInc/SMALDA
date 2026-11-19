import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute, DisputeStatus, ALLOWED_DISPUTE_TRANSITIONS } from './entities/dispute.entity';
import { DisputeReasonClassifierService } from './dispute-reason-classifier.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DisputeResponseDto } from './dto/dispute-response.dto';
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
    const reason = await this.classifier.classifyDispute(dto.description);

    const dispute = this.disputeRepo.create({
      documentId: dto.documentId,
      description: dto.description,
      reason,
      filedBy: userId,
      status: DisputeStatus.OPEN,
    });

    const saved = await this.disputeRepo.save(dispute);

    await this.accessLogsService.logDocumentAccess(
      dto.documentId,
      `dispute_filed:${DisputeStatus.OPEN}`,
      userId,
    );

    await this.notify(
      userId,
      'Dispute filed',
      `Your dispute for document ${dto.documentId} was filed.`,
      dto.documentId,
    );

    return this.toResponseDto(saved);
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
      createdAt: dispute.createdAt,
    };
  }
}
