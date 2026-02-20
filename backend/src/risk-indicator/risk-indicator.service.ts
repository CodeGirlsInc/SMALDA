import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiskIndicator } from './entities/risk-indicator.entity';
import { CreateRiskIndicatorDto } from './dto/create-risk-indicator.dto';

@Injectable()
export class RiskIndicatorService {
  constructor(
    @InjectRepository(RiskIndicator)
    private readonly riskIndicatorRepository: Repository<RiskIndicator>,
  ) {}

  async createIndicator(dto: CreateRiskIndicatorDto): Promise<RiskIndicator> {
    const indicator = this.riskIndicatorRepository.create(dto);
    return this.riskIndicatorRepository.save(indicator);
  }

  async findByDocument(documentId: string): Promise<RiskIndicator[]> {
    return this.riskIndicatorRepository.find({
      where: { documentId },
      order: { detectedAt: 'DESC' },
    });
  }

  async resolveIndicator(id: string): Promise<RiskIndicator> {
    const indicator = await this.riskIndicatorRepository.findOne({ where: { id } });

    if (!indicator) {
      throw new NotFoundException(`Risk indicator with ID ${id} not found`);
    }

    indicator.isResolved = true;
    indicator.resolvedAt = new Date();

    return this.riskIndicatorRepository.save(indicator);
  }

  async getUnresolved(): Promise<RiskIndicator[]> {
    return this.riskIndicatorRepository.find({
      where: { isResolved: false },
      order: { detectedAt: 'DESC' },
    });
  }
}
