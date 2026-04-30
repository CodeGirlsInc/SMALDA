import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DisputeReason } from './entities/dispute-reason.entity';

@Injectable()
export class DisputeReasonClassifierService {
  constructor(
    @InjectRepository(DisputeReason)
    private readonly reasonRepo: Repository<DisputeReason>,
  ) {}

  async findAllReasons(): Promise<DisputeReason[]> {
    return this.reasonRepo.find();
  }

  async classifyDispute(description: string): Promise<DisputeReason | null> {
    const reasons = await this.findAllReasons();
    const matched = reasons.find((reason) =>
      description.toLowerCase().includes(reason.name.toLowerCase()),
    );
    return matched ?? null;
  }
}
