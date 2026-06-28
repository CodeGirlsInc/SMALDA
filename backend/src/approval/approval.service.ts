import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Approval, ApprovalStatus } from './approval.entity';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { UpdateApprovalDto } from './dto/update-approval.dto';
import { VerificationRecord } from '../verification/entities/verification-record.entity';

@Injectable()
export class ApprovalService {
  constructor(
    @InjectRepository(Approval)
    private readonly approvalRepo: Repository<Approval>,
    @InjectRepository(VerificationRecord)
    private readonly verificationRepo: Repository<VerificationRecord>,
  ) {}

  async create(dto: CreateApprovalDto): Promise<Approval> {
    const verification = await this.verificationRepo.findOne({
      where: { id: dto.verificationId },
    });
    if (!verification) {
      throw new NotFoundException('Verification record not found');
    }

    const existing = await this.approvalRepo.findOne({
      where: {
        verificationId: dto.verificationId,
        approverId: dto.approverId,
      },
    });
    if (existing) {
      throw new BadRequestException('Approver already has a pending request for this verification');
    }

    const approval = this.approvalRepo.create({
      verificationId: dto.verificationId,
      approverId: dto.approverId,
      comment: dto.comment,
      requiredCount: dto.requiredCount || 2,
    });

    return this.approvalRepo.save(approval);
  }

  async update(id: string, dto: UpdateApprovalDto): Promise<Approval> {
    const approval = await this.approvalRepo.findOne({ where: { id } });
    if (!approval) {
      throw new NotFoundException('Approval record not found');
    }
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Request already processed');
    }

    approval.status = dto.status;
    if (dto.comment) approval.comment = dto.comment;
    return this.approvalRepo.save(approval);
  }

  async findByVerification(verificationId: string): Promise<Approval[]> {
    return this.approvalRepo.find({
      where: { verificationId },
      relations: ['approver'],
    });
  }

  async checkGate(verificationId: string): Promise<{ approved: boolean; required: number; current: number }> {
    const approvals = await this.approvalRepo.find({
      where: { verificationId },
    });

    if (approvals.length === 0) {
      return { approved: false, required: 2, current: 0 };
    }

    const required = approvals[0].requiredCount;
    const approved = approvals.filter((a) => a.status === ApprovalStatus.APPROVED).length;

    return {
      approved: approved >= required,
      required,
      current: approved,
    };
  }
}
