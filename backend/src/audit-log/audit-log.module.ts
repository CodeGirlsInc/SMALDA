import { Module, Global } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AuditLogController } from "./audit-log.controller"
import { AuditLogService } from "./audit-log.service"
import { AuditLog } from "./entities/audit-log.entity"
import { AuditInterceptor } from "./interceptors/audit.interceptor"

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditLogController],
  providers: [AuditLogService, AuditInterceptor],
  exports: [AuditLogService, AuditInterceptor],
})
export class AuditLogModule {}
