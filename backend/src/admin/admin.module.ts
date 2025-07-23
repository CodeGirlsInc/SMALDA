import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AdminController } from "./admin.controller"
import { UserManagementService } from "./services/user-management.service"
import { AdminDashboardService } from "./services/admin-dashboard.service"
import { User } from "./entities/user.entity"
import { Document } from "../documents/entities/document.entity"
import { RiskAnalysis } from "../risk-analysis/entities/risk-analysis.entity"
import { AuditLog } from "../audit-log/entities/audit-log.entity"
import { Notification } from "../notification/entities/notification.entity"
import { AdminGuard } from "./guards/admin.guard"

@Module({
  imports: [TypeOrmModule.forFeature([User, Document, RiskAnalysis, AuditLog, Notification])],
  controllers: [AdminController],
  providers: [UserManagementService, AdminDashboardService, AdminGuard],
  exports: [UserManagementService, AdminDashboardService],
})
export class AdminModule {}
