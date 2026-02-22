import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, LessThan, Repository } from 'typeorm';
import { DocumentExpiry } from './entities/document-expiry.entity';
import { SetExpiryDto } from './dto/set-expiry.dto';
import { ExpiryStatus } from './interfaces/expiry-status.interface';
import { ExpiryStatusDto } from './dto/expiry-status.dto';

@Injectable()
export class DocumentExpiryService {
  constructor(
    @InjectRepository(DocumentExpiry)
    private readonly expiryRepository: Repository<DocumentExpiry>,
  ) {}

  /**
   * Creates or updates the expiry record for a document.
   * If a record already exists for the documentId it is overwritten.
   */
  async setExpiry(dto: SetExpiryDto): Promise<DocumentExpiry> {
    const expiryDate = new Date(dto.expiryDate);

    if (isNaN(expiryDate.getTime())) {
      throw new BadRequestException(
        `"${dto.expiryDate}" is not a valid date string.`,
      );
    }

    const existing = await this.expiryRepository.findOne({
      where: { documentId: dto.documentId },
    });

    if (existing) {
      existing.expiryDate = expiryDate;
      existing.renewalPeriodDays = dto.renewalPeriodDays ?? existing.renewalPeriodDays;
      existing.notes = dto.notes ?? existing.notes;
      existing.renewedAt = null; // reset renewal when a new expiry is set
      return this.expiryRepository.save(existing);
    }

    const record = this.expiryRepository.create({
      documentId: dto.documentId,
      expiryDate,
      renewalPeriodDays: dto.renewalPeriodDays ?? 30,
      notes: dto.notes ?? null,
    });

    return this.expiryRepository.save(record);
  }

  /**
   * Marks a document as renewed: sets renewedAt to now and advances
   * expiryDate by the stored renewalPeriodDays.
   */
  async markRenewed(documentId: string): Promise<DocumentExpiry> {
    const record = await this.findOrFail(documentId);

    const now = new Date();
    const newExpiry = new Date(record.expiryDate);
    newExpiry.setDate(newExpiry.getDate() + record.renewalPeriodDays);

    record.renewedAt = now;
    record.expiryDate = newExpiry;

    return this.expiryRepository.save(record);
  }

  /**
   * Returns all documents whose expiryDate falls within the next `withinDays` days
   * and that have not been renewed (renewedAt IS NULL).
   * Results are ordered from soonest to latest expiry.
   */
  async getExpiringSoon(withinDays: number): Promise<DocumentExpiry[]> {
    if (withinDays < 1) {
      throw new BadRequestException('withinDays must be at least 1.');
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

    return this.expiryRepository.find({
      where: {
        expiryDate: Between(now, cutoff),
        renewedAt: IsNull(),
      },
      order: { expiryDate: 'ASC' },
    });
  }

  /**
   * Returns all documents whose expiryDate is in the past and have never been renewed.
   * Results are ordered from oldest expiry first.
   */
  async getExpired(): Promise<DocumentExpiry[]> {
    return this.expiryRepository.find({
      where: {
        expiryDate: LessThan(new Date()),
        renewedAt: IsNull(),
      },
      order: { expiryDate: 'ASC' },
    });
  }

  /**
   * Returns enriched expiry status for a single document:
   * the full record, days until expiry (negative if expired), and a status label.
   */
  async checkExpiry(documentId: string): Promise<ExpiryStatusDto> {
    const record = await this.findOrFail(documentId);
    return this.buildStatusDto(record);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async findOrFail(documentId: string): Promise<DocumentExpiry> {
    const record = await this.expiryRepository.findOne({
      where: { documentId },
    });

    if (!record) {
      throw new NotFoundException(
        `No expiry record found for document ID "${documentId}"`,
      );
    }

    return record;
  }

  private buildStatusDto(record: DocumentExpiry): ExpiryStatusDto {
    const now = new Date();
    const expiry = new Date(record.expiryDate);
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / msPerDay);

    let status: ExpiryStatus['status'];

    if (daysUntilExpiry < 0) {
      status = 'EXPIRED';
    } else if (daysUntilExpiry <= record.renewalPeriodDays) {
      status = 'EXPIRING_SOON';
    } else {
      status = 'VALID';
    }

    return { record, daysUntilExpiry, status };
  }
}
