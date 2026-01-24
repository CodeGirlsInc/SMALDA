import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { Report, ReportType, ReportFormat, ReportStatus } from '../entities/report.entity';
import { ReportTemplate } from '../entities/report-template.entity';
import { StellarTransaction } from '../../stellar/entities/stellar-transaction.entity';
import { User } from '../../entities/user.entity';
import { GenerateReportDto } from '../dto/generate-report.dto';
import { ReportFilterDto } from '../dto/report-filter.dto';
import { AnalyticsService } from './analytics.service';
import { PdfExportService } from './pdf-export.service';
import { ExcelExportService } from './excel-export.service';
import { CacheService } from './cache.service';
import * as fs from 'fs';

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(ReportTemplate)
    private readonly templateRepository: Repository<ReportTemplate>,
    @InjectRepository(StellarTransaction)
    private readonly transactionRepository: Repository<StellarTransaction>,
    private readonly analyticsService: AnalyticsService,
    private readonly pdfExportService: PdfExportService,
    private readonly excelExportService: ExcelExportService,
    private readonly cacheService: CacheService,
  ) {}

  async generateReport(userId: string, dto: GenerateReportDto): Promise<Report> {
    this.logger.log(`Generating report for user ${userId}: ${dto.title}`);

    const startTime = Date.now();

    // Create report record
    const report = this.reportRepository.create({
      title: dto.title,
      description: dto.description,
      type: dto.type,
      format: dto.format,
      userId,
      status: ReportStatus.PROCESSING,
      startDate: dto.startDate ? new Date(dto.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: dto.endDate ? new Date(dto.endDate) : new Date(),
      filters: dto.filters || {},
      templateId: dto.templateId,
    });

    await this.reportRepository.save(report);

    try {
      // Generate report data based on type
      const reportData = await this.generateReportData(report);

      // Export to file
      const filePath = await this.exportReport(report, reportData);
      const stats = fs.statSync(filePath);

      // Update report with results
      report.status = ReportStatus.COMPLETED;
      report.data = reportData;
      report.filePath = filePath;
      report.fileSize = stats.size;
      report.completedAt = new Date();
      report.generationTimeMs = Date.now() - startTime;

      await this.reportRepository.save(report);

      this.logger.log(`Report generated successfully: ${report.id}`);
      return report;
    } catch (error) {
      this.logger.error(`Report generation failed: ${error.message}`, error.stack);

      report.status = ReportStatus.FAILED;
      report.errorMessage = error.message;
      report.generationTimeMs = Date.now() - startTime;

      await this.reportRepository.save(report);
      throw error;
    }
  }

  async findAll(userId: string, filter: ReportFilterDto): Promise<{ data: Report[]; total: number }> {
    this.logger.log(`Finding reports for user ${userId} with filters`);

    const where: FindOptionsWhere<Report> = { userId };

    if (filter.type) where.type = filter.type;
    if (filter.status) where.status = filter.status;
    if (filter.format) where.format = filter.format;

    const queryBuilder = this.reportRepository.createQueryBuilder('report')
      .where(where);

    if (filter.startDate && filter.endDate) {
      queryBuilder.andWhere('report.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(filter.startDate),
        endDate: new Date(filter.endDate),
      });
    }

    const page = filter.page || 1;
    const limit = filter.limit || 10;
    const skip = (page - 1) * limit;

    queryBuilder
      .orderBy(`report.${filter.sortBy || 'createdAt'}`, filter.sortOrder || 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }

  async findOne(userId: string, id: string): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: { id, userId },
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }

    return report;
  }

  async delete(userId: string, id: string): Promise<void> {
    const report = await this.findOne(userId, id);

    // Delete file if exists
    if (report.filePath && fs.existsSync(report.filePath)) {
      fs.unlinkSync(report.filePath);
    }

    await this.reportRepository.delete(id);
    this.logger.log(`Report deleted: ${id}`);
  }

  async downloadReport(userId: string, id: string): Promise<{ filePath: string; fileName: string }> {
    const report = await this.findOne(userId, id);

    if (report.status !== ReportStatus.COMPLETED) {
      throw new Error('Report is not ready for download');
    }

    if (!report.filePath || !fs.existsSync(report.filePath)) {
      throw new NotFoundException('Report file not found');
    }

    const fileName = `${report.title}-${report.id}.${report.format}`;
    return { filePath: report.filePath, fileName };
  }

  private async generateReportData(report: Report): Promise<any> {
    const cacheKey = this.cacheService.generateCacheKey('report-data', {
      type: report.type,
      startDate: report.startDate.toISOString(),
      endDate: report.endDate.toISOString(),
    });

    return this.cacheService.wrap(
      cacheKey,
      async () => {
        switch (report.type) {
          case ReportType.DOCUMENT_VERIFICATION:
            return this.generateDocumentVerificationData(report);
          
          case ReportType.USER_ACTIVITY:
            return this.generateUserActivityData(report);
          
          case ReportType.SYSTEM_ANALYTICS:
            return this.generateSystemAnalyticsData(report);
          
          default:
            throw new Error(`Unsupported report type: ${report.type}`);
        }
      },
      600, // Cache for 10 minutes
    );
  }

  private async generateDocumentVerificationData(report: Report): Promise<any> {
    const [analytics, transactions] = await Promise.all([
      this.analyticsService.getDocumentAnalytics(report.startDate, report.endDate),
      this.transactionRepository.find({
        where: {
          createdAt: Between(report.startDate, report.endDate),
        },
        order: { createdAt: 'DESC' },
      }),
    ]);

    return {
      summary: analytics,
      transactions,
      verificationsPerDay: analytics.verificationsPerDay,
      riskTrends: analytics.riskTrends,
      startDate: report.startDate.toISOString().split('T')[0],
      endDate: report.endDate.toISOString().split('T')[0],
    };
  }

  private async generateUserActivityData(report: Report): Promise<any> {
    const analytics = await this.analyticsService.getUserActivityAnalytics(
      report.startDate,
      report.endDate,
    );

    return {
      summary: analytics,
      mostActiveUsers: analytics.mostActiveUsers,
      userGrowth: analytics.userGrowth,
      startDate: report.startDate.toISOString().split('T')[0],
      endDate: report.endDate.toISOString().split('T')[0],
    };
  }

  private async generateSystemAnalyticsData(report: Report): Promise<any> {
    const analytics = await this.analyticsService.getSystemAnalytics(
      report.startDate,
      report.endDate,
    );

    return {
      summary: analytics,
      networkDistribution: analytics.networkDistribution,
      statusDistribution: analytics.statusDistribution,
      peakHours: analytics.peakHours,
      startDate: report.startDate.toISOString().split('T')[0],
      endDate: report.endDate.toISOString().split('T')[0],
    };
  }

  private async exportReport(report: Report, data: any): Promise<string> {
    const options = {
      title: report.title,
      author: 'Smalda System',
      subject: report.description,
    };

    switch (report.format) {
      case ReportFormat.PDF:
        return this.exportToPdf(report.type, data, options);
      
      case ReportFormat.EXCEL:
        return this.exportToExcel(report.type, data, report.title);
      
      case ReportFormat.CSV:
        return this.exportToCsv(report.type, data, report.title);
      
      default:
        throw new Error(`Unsupported export format: ${report.format}`);
    }
  }

  private async exportToPdf(type: ReportType, data: any, options: any): Promise<string> {
    switch (type) {
      case ReportType.DOCUMENT_VERIFICATION:
        return this.pdfExportService.generateDocumentVerificationReport(data, options);
      
      case ReportType.USER_ACTIVITY:
        return this.pdfExportService.generateUserActivityReport(data, options);
      
      case ReportType.SYSTEM_ANALYTICS:
        return this.pdfExportService.generateSystemAnalyticsReport(data, options);
      
      default:
        throw new Error(`Unsupported PDF report type: ${type}`);
    }
  }

  private async exportToExcel(type: ReportType, data: any, title: string): Promise<string> {
    switch (type) {
      case ReportType.DOCUMENT_VERIFICATION:
        return this.excelExportService.generateDocumentVerificationExcel(data, title);
      
      case ReportType.USER_ACTIVITY:
        return this.excelExportService.generateUserActivityExcel(data, title);
      
      case ReportType.SYSTEM_ANALYTICS:
        return this.excelExportService.generateSystemAnalyticsExcel(data, title);
      
      default:
        throw new Error(`Unsupported Excel report type: ${type}`);
    }
  }

  private async exportToCsv(type: ReportType, data: any, title: string): Promise<string> {
    let csvData: any[];
    let columns: string[];

    switch (type) {
      case ReportType.DOCUMENT_VERIFICATION:
        csvData = data.transactions || [];
        columns = ['transactionHash', 'documentHash', 'status', 'network', 'fee', 'createdAt'];
        break;
      
      case ReportType.USER_ACTIVITY:
        csvData = data.mostActiveUsers || [];
        columns = ['userId', 'email', 'activityCount'];
        break;
      
      case ReportType.SYSTEM_ANALYTICS:
        csvData = data.networkDistribution || [];
        columns = ['network', 'count'];
        break;
      
      default:
        throw new Error(`Unsupported CSV report type: ${type}`);
    }

    return this.excelExportService.generateCSV(csvData, columns, title);
  }
}
