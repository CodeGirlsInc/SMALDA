import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { DateRangeDto } from './dto/date-range.dto';
import { MonthsQueryDto } from './dto/months-query.dto';
import { LimitQueryDto } from './dto/limit-query.dto';

@Controller('api/reports')
export class ReportingController {
  constructor(
    private readonly reportingService: ReportingService,
  ) {}

  /* -------------------------------------------------------------------------- */
  /* 1️⃣ Document Summary                                                        */
  /* GET /api/reports/summary?from=&to=                                         */
  /* -------------------------------------------------------------------------- */

  @Get('summary')
  async getDocumentSummary(@Query() query: DateRangeDto) {
    const { from, to } = query.resolve();

    const result =
      await this.reportingService.getDocumentSummary(
        from,
        to,
      );

    return {
      success: true,
      data: result,
    };
  }

  /* -------------------------------------------------------------------------- */
  /* 2️⃣ Risk Distribution                                                       */
  /* GET /api/reports/risk-distribution                                         */
  /* -------------------------------------------------------------------------- */

  @Get('risk-distribution')
  async getRiskDistribution() {
    const result =
      await this.reportingService.getRiskDistribution();

    return {
      success: true,
      data: result,
    };
  }

  /* -------------------------------------------------------------------------- */
  /* 3️⃣ Verification Trend                                                      */
  /* GET /api/reports/verification-trend?months=6                               */
  /* -------------------------------------------------------------------------- */

  @Get('verification-trend')
  async getVerificationTrend(@Query() query: MonthsQueryDto) {
    const months = query.resolve();

    const result =
      await this.reportingService.getVerificationTrend(
        months,
      );

    return {
      success: true,
      data: result,
    };
  }

  /* -------------------------------------------------------------------------- */
  /* 4️⃣ Top Risky Documents                                                     */
  /* GET /api/reports/top-risky?limit=10                                        */
  /* -------------------------------------------------------------------------- */

  @Get('top-risky')
  async getTopRiskyDocuments(@Query() query: LimitQueryDto) {
    const limit = query.resolve();

    const result =
      await this.reportingService.getTopRiskyDocuments(
        limit,
      );

    return {
      success: true,
      data: result,
    };
  }

  /* -------------------------------------------------------------------------- */
  /* 5️⃣ System Health                                                           */
  /* GET /api/reports/system-health                                              */
  /* -------------------------------------------------------------------------- */

  @Get('system-health')
  async getSystemHealth() {
    const result =
      await this.reportingService.getSystemHealth();

    return {
      success: true,
      data: result,
    };
  }
}