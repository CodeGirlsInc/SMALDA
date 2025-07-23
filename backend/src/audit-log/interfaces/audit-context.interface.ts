import type { AuditAction, AuditSeverity } from "../entities/audit-log.entity"

export interface AuditContext {
  userId: string
  userEmail: string
  ipAddress?: string
  userAgent?: string
}

export interface AuditLogData {
  action: AuditAction
  severity?: AuditSeverity
  description: string
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, any>
  success?: boolean
  errorMessage?: string
}
