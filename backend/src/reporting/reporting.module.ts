import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Report } from './entities/report.entity';
import { ReportTemplate } from './entities/report-template.entity';
import { ReportSchedule } from './entities/report-schedule.entity';
import { StellarTransaction } from '../stellar/entities/stellar-transaction.entity';
import { User } from '../entities/user.entity';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './services/reporting.service';
import { AnalyticsService } from './services/analytics.service';
import { PdfExportService } from './services/pdf-export.service';
import { ExcelExportService } from './services/excel-export.service';
import { CacheService } from './services/cache.service';
import { ScheduleService } from './services/schedule.service';
import { TemplateService } from './services/template.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Report,
      ReportTemplate,
      ReportSchedule,
      StellarTransaction,
      User,
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [ReportingController],
  providers: [
    ReportingService,
    AnalyticsService,
    PdfExportService,
    ExcelExportService,
    CacheService,
    ScheduleService,
    TemplateService,
  ],
  exports: [
    ReportingService,
    AnalyticsService,
    TemplateService,
  ],
})
export class ReportingModule implements OnModuleInit {
  constructor(private readonly templateService: TemplateService) {}

  async onModuleInit() {
    // Seed default templates on module initialization
    await this.templateService.seedDefaultTemplates();
  }
}
