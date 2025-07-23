import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { BullModule } from "@nestjs/bull"
import { ReportingController } from "./reporting.controller"
import { ReportingService } from "./reporting.service"
import { Report } from "./entities/report.entity"
import { DataAggregatorService } from "./services/data-aggregator.service"
import { PdfGeneratorService } from "./services/pdf-generator.service"
import { CsvGeneratorService } from "./services/csv-generator.service"
import { ReportProcessor } from "./processors/report.processor"
import { Document } from "../documents/entities/document.entity"
import { RiskAnalysis } from "../risk-analysis/entities/risk-analysis.entity"
import { AuditLog } from "../audit-log/entities/audit-log.entity"
import { User } from "../admin/entities/user.entity"
import { Notification } from "../notification/entities/notification.entity"

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, Document, RiskAnalysis, AuditLog, User, Notification]),
    BullModule.registerQueue({
      name: "report",
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number.parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
      },
    }),
  ],
  controllers: [ReportingController],
  providers: [ReportingService, DataAggregatorService, PdfGeneratorService, CsvGeneratorService, ReportProcessor],
  exports: [ReportingService],
})
export class ReportingModule {}
