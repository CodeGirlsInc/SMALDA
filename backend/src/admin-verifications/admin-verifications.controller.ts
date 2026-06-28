import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { VerificationRecord } from '../verification/entities/verification-record.entity';
import { IsOptional, IsString, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class QueryVerificationsDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsString()
  stellarTxHash?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

@Controller('admin/verifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminVerificationsController {
  constructor(
    @InjectRepository(VerificationRecord)
    private readonly verificationRepo: Repository<VerificationRecord>,
  ) {}

  @Get()
  async findAll(@Query() query: QueryVerificationsDto) {
    const { status, documentId, stellarTxHash, startDate, endDate, page = 1, limit = 20 } = query;
    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (documentId) where.documentId = documentId;
    if (stellarTxHash) where.stellarTxHash = Like(`%${stellarTxHash}%`);
    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      where.createdAt = Between(new Date(startDate), new Date('2100-01-01'));
    } else if (endDate) {
      where.createdAt = Between(new Date('1970-01-01'), new Date(endDate));
    }

    const [data, total] = await this.verificationRepo.findAndCount({
      where,
      take: limit,
      skip: (page - 1) * limit,
      order: { createdAt: 'DESC' },
      relations: ['document'],
    });

    return { data, total, page, limit };
  }
}
