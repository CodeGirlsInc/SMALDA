import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { RiskAnalysisController } from "./risk-analysis.controller"
import { RiskAnalysisService } from "./risk-analysis.service"
import { RiskAnalysis } from "./entities/risk-analysis.entity"
import { StaticRulesAnalyzer } from "./analyzers/static-rules.analyzer"
import { AiMockAnalyzer } from "./analyzers/ai-mock.analyzer"
import { DocumentsModule } from "../documents/documents.module"
import { NotificationModule } from "../notification/notification.module"

@Module({
  imports: [TypeOrmModule.forFeature([RiskAnalysis]), DocumentsModule, NotificationModule],
  controllers: [RiskAnalysisController],
  providers: [RiskAnalysisService, StaticRulesAnalyzer, AiMockAnalyzer],
  exports: [RiskAnalysisService],
})
export class RiskAnalysisModule {}
