import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportTemplate } from '../entities/report-template.entity';
import { CreateTemplateDto, UpdateTemplateDto } from '../dto/template.dto';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    @InjectRepository(ReportTemplate)
    private readonly templateRepository: Repository<ReportTemplate>,
  ) {}

  async create(userId: string, dto: CreateTemplateDto): Promise<ReportTemplate> {
    this.logger.log(`Creating report template: ${dto.name}`);

    const template = this.templateRepository.create({
      ...dto,
      createdBy: userId,
    });

    return this.templateRepository.save(template);
  }

  async findAll(includeInactive = false): Promise<ReportTemplate[]> {
    const where = includeInactive ? {} : { isActive: true };
    
    return this.templateRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ReportTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return template;
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<ReportTemplate> {
    const template = await this.findOne(id);

    // Don't allow updating system templates
    if (template.isSystem) {
      throw new Error('Cannot update system templates');
    }

    Object.assign(template, dto);
    return this.templateRepository.save(template);
  }

  async delete(id: string): Promise<void> {
    const template = await this.findOne(id);

    // Don't allow deleting system templates
    if (template.isSystem) {
      throw new Error('Cannot delete system templates');
    }

    await this.templateRepository.delete(id);
    this.logger.log(`Template deleted: ${id}`);
  }

  async seedDefaultTemplates(): Promise<void> {
    this.logger.log('Seeding default report templates...');

    const existingTemplates = await this.templateRepository.count();
    if (existingTemplates > 0) {
      this.logger.log('Templates already exist, skipping seed');
      return;
    }

    const defaultTemplates = [
      {
        name: 'Document Verification Report',
        description: 'Comprehensive report of all document verifications',
        type: 'document_verification' as any,
        supportedFormats: ['pdf', 'excel', 'csv'] as any,
        config: {
          columns: ['transactionHash', 'documentHash', 'status', 'network', 'createdAt'],
          charts: ['verifications_per_day', 'success_rate'],
          filters: ['dateRange', 'status', 'network'],
          layout: 'standard',
        },
        isSystem: true,
        isActive: true,
      },
      {
        name: 'User Activity Report',
        description: 'Report showing user engagement and activity metrics',
        type: 'user_activity' as any,
        supportedFormats: ['pdf', 'excel'] as any,
        config: {
          columns: ['userId', 'email', 'activityCount', 'lastLogin'],
          charts: ['user_growth', 'active_users'],
          filters: ['dateRange', 'userStatus'],
          layout: 'standard',
        },
        isSystem: true,
        isActive: true,
      },
      {
        name: 'System Analytics Report',
        description: 'System-wide analytics and performance metrics',
        type: 'system_analytics' as any,
        supportedFormats: ['pdf', 'excel'] as any,
        config: {
          columns: ['metric', 'value', 'trend'],
          charts: ['transaction_volume', 'network_distribution', 'peak_hours'],
          filters: ['dateRange'],
          layout: 'dashboard',
        },
        isSystem: true,
        isActive: true,
      },
    ];

    for (const template of defaultTemplates) {
      await this.templateRepository.save(template);
    }

    this.logger.log(`Seeded ${defaultTemplates.length} default templates`);
  }
}
