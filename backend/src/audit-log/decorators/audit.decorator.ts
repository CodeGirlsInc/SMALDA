import { SetMetadata } from "@nestjs/common"
import type { AuditAction, AuditSeverity } from "../entities/audit-log.entity"

export const AUDIT_KEY = "audit"

export interface AuditOptions {
  action: AuditAction
  severity?: AuditSeverity
  resourceType?: string
  description?: string
}

export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options)
