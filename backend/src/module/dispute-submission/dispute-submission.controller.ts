import { Body, Controller, Post, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsNotEmpty, IsUUID, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Document } from '../../documents/entities/document.entity';
import { User } from '../../users/entities/user.entity';

class CreateDisputeDto {
  @IsUUID() documentId: string;
  @MinLength(20) description: string;
  @IsNotEmpty() disputeType: string;
}

@Controller('module/disputes')
@UseGuards(JwtAuthGuard)
export class DisputeSubmissionController {
  constructor(@InjectRepository(Document) private readonly docs: Repository<Document>) {}

  @Post()
  async submit(@Body() dto: CreateDisputeDto, @Req() req: { user: User }) {
    const doc = await this.docs.findOneBy({ id: dto.documentId });
    if (!doc) throw new NotFoundException('Document not found');
    return {
      id: crypto.randomUUID(),
      documentId: dto.documentId,
      submittedBy: req.user.id,
      description: dto.description,
      disputeType: dto.disputeType,
      status: 'OPEN',
      createdAt: new Date(),
    };
  }
}