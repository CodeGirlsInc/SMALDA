import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReportSchedule, ScheduleFrequency } from '../entities/report-schedule.entity';
import { CreateScheduleDto, UpdateScheduleDto } from '../dto/schedule.dto';
import { ReportingService } from './reporting.service';
import { ReportFormat, ReportType } from '../entities/report.entity';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    @InjectRepository(ReportSchedule)
    private readonly scheduleRepository: Repository<ReportSchedule>,
    private readonly reportingService: ReportingService,
  ) {}

  async create(userId: string, dto: CreateScheduleDto): Promise<ReportSchedule> {
    this.logger.log(`Creating schedule for user ${userId}: ${dto.name}`);

    const schedule = this.scheduleRepository.create({
      name: dto.name,
      description: dto.description,
      userId,
      templateId: dto.templateId,
      frequency: dto.frequency,
      cronExpression: dto.cronExpression,
      filters: dto.filters || {},
      recipients: dto.recipients || [],
      nextRunAt: this.calculateNextRun(dto.frequency, dto.cronExpression),
    });

    return this.scheduleRepository.save(schedule);
  }

  async findAll(userId: string): Promise<ReportSchedule[]> {
    return this.scheduleRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: string): Promise<ReportSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, userId },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }

    return schedule;
  }

  async update(userId: string, id: string, dto: UpdateScheduleDto): Promise<ReportSchedule> {
    const schedule = await this.findOne(userId, id);

    Object.assign(schedule, dto);

    if (dto.frequency || dto.cronExpression) {
      schedule.nextRunAt = this.calculateNextRun(
        dto.frequency || schedule.frequency,
        dto.cronExpression || schedule.cronExpression,
      );
    }

    return this.scheduleRepository.save(schedule);
  }

  async delete(userId: string, id: string): Promise<void> {
    const schedule = await this.findOne(userId, id);
    await this.scheduleRepository.delete(schedule.id);
    this.logger.log(`Schedule deleted: ${id}`);
  }

  async toggleActive(userId: string, id: string): Promise<ReportSchedule> {
    const schedule = await this.findOne(userId, id);
    schedule.isActive = !schedule.isActive;
    return this.scheduleRepository.save(schedule);
  }

  // Run every hour to check for scheduled reports
  @Cron(CronExpression.EVERY_HOUR)
  async processScheduledReports(): Promise<void> {
    this.logger.log('Processing scheduled reports...');

    const now = new Date();
    const schedules = await this.scheduleRepository.find({
      where: { isActive: true },
    });

    const dueTasks = schedules.filter(
      schedule => schedule.nextRunAt && schedule.nextRunAt <= now,
    );

    this.logger.log(`Found ${dueTasks.length} scheduled reports to process`);

    for (const schedule of dueTasks) {
      try {
        await this.executeSchedule(schedule);
      } catch (error) {
        this.logger.error(
          `Failed to execute schedule ${schedule.id}: ${error.message}`,
          error.stack,
        );
      }
    }
  }

  private async executeSchedule(schedule: ReportSchedule): Promise<void> {
    this.logger.log(`Executing schedule: ${schedule.id} - ${schedule.name}`);

    try {
      // Generate report based on template
      const template = schedule.template;
      
      const reportDto = {
        title: `${schedule.name} - ${new Date().toLocaleDateString()}`,
        description: schedule.description,
        type: template.type,
        format: template.supportedFormats[0] || ReportFormat.PDF,
        filters: schedule.filters,
        templateId: schedule.templateId,
      };

      await this.reportingService.generateReport(schedule.userId, reportDto as any);

      // Update schedule
      schedule.lastRunAt = new Date();
      schedule.nextRunAt = this.calculateNextRun(schedule.frequency, schedule.cronExpression);
      schedule.runCount += 1;
      schedule.lastError = null;

      await this.scheduleRepository.save(schedule);

      this.logger.log(`Schedule executed successfully: ${schedule.id}`);
    } catch (error) {
      schedule.failureCount += 1;
      schedule.lastError = error.message;
      await this.scheduleRepository.save(schedule);
      throw error;
    }
  }

  private calculateNextRun(frequency: ScheduleFrequency, cronExpression?: string): Date {
    const now = new Date();

    switch (frequency) {
      case ScheduleFrequency.DAILY:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      case ScheduleFrequency.WEEKLY:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      case ScheduleFrequency.MONTHLY:
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;
      
      case ScheduleFrequency.CUSTOM:
        // For custom cron expressions, calculate next run
        // This is a simplified version - in production, use a cron parser library
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }
}
