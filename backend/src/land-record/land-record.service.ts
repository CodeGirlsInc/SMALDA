import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { LandRecord } from './entities/land-record.entity';
import { CreateLandRecordDto } from './dto/create-land-record.dto';
import { UpdateLandRecordDto } from './dto/update-land-record.dto';
import { FilterLandRecordDto } from './dto/filter-land-record.dto';

@Injectable()
export class LandRecordService {
  constructor(
    @InjectRepository(LandRecord)
    private readonly landRecordRepository: Repository<LandRecord>,
  ) {}

  async create(dto: CreateLandRecordDto): Promise<LandRecord> {
    const existing = await this.landRecordRepository.findOne({
      where: { parcelId: dto.parcelId },
    });

    if (existing) {
      throw new ConflictException(
        `A land record with parcel ID "${dto.parcelId}" already exists`,
      );
    }

    const record = this.landRecordRepository.create(dto);
    return this.landRecordRepository.save(record);
  }

  async findAll(filters: FilterLandRecordDto): Promise<LandRecord[]> {
    const where: FindOptionsWhere<LandRecord> = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.location) {
      where.location = ILike(`%${filters.location}%`);
    }

    return this.landRecordRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<LandRecord> {
    const record = await this.landRecordRepository.findOne({ where: { id } });

    if (!record) {
      throw new NotFoundException(`Land record with ID "${id}" not found`);
    }

    return record;
  }

  async update(id: string, dto: UpdateLandRecordDto): Promise<LandRecord> {
    const record = await this.findOne(id);

    if (dto.parcelId && dto.parcelId !== record.parcelId) {
      const conflict = await this.landRecordRepository.findOne({
        where: { parcelId: dto.parcelId },
      });

      if (conflict) {
        throw new ConflictException(
          `A land record with parcel ID "${dto.parcelId}" already exists`,
        );
      }
    }

    Object.assign(record, dto);
    return this.landRecordRepository.save(record);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.landRecordRepository.softDelete(id);
  }
}
