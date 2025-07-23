import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import type { Observable } from "rxjs"
import { tap, catchError } from "rxjs/operators"
import { throwError } from "rxjs"
import type { AuditLogService } from "../audit-log.service"
import { AUDIT_KEY, type AuditOptions } from "../decorators/audit.decorator"
import { AuditSeverity } from "../entities/audit-log.entity"
import type { Request } from "express"

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditOptions = this.reflector.get<AuditOptions>(AUDIT_KEY, context.getHandler())

    if (!auditOptions) {
      return next.handle()
    }

    const request = context.switchToHttp().getRequest<Request>()
    const { action, severity = AuditSeverity.LOW, resourceType, description } = auditOptions

    // Extract user context from request (you might need to adjust this based on your auth implementation)
    const userId = (request.headers["x-user-id"] as string) || "system"
    const userEmail = (request.headers["x-user-email"] as string) || "system@example.com"
    const ipAddress = request.ip || request.connection.remoteAddress
    const userAgent = request.headers["user-agent"]

    const auditContext = {
      userId,
      userEmail,
      ipAddress,
      userAgent,
    }

    return next.handle().pipe(
      tap((response) => {
        // Log successful operation
        const resourceId = this.extractResourceId(request, response)

        this.auditLogService
          .log(auditContext, {
            action,
            severity,
            description: description || `${action} completed successfully`,
            resourceType,
            resourceId,
            metadata: {
              method: request.method,
              url: request.url,
              params: request.params,
              query: request.query,
              responseStatus: "success",
            },
            success: true,
          })
          .catch((error) => {
            console.error("Failed to log audit entry:", error)
          })
      }),
      catchError((error) => {
        // Log failed operation
        const resourceId = this.extractResourceId(request)

        this.auditLogService
          .log(auditContext, {
            action,
            severity: AuditSeverity.HIGH,
            description: description || `${action} failed`,
            resourceType,
            resourceId,
            metadata: {
              method: request.method,
              url: request.url,
              params: request.params,
              query: request.query,
              responseStatus: "error",
              errorType: error.constructor.name,
            },
            success: false,
            errorMessage: error.message,
          })
          .catch((auditError) => {
            console.error("Failed to log audit entry:", auditError)
          })

        return throwError(() => error)
      }),
    )
  }

  private extractResourceId(request: Request, response?: any): string | undefined {
    // Try to extract resource ID from various sources
    if (request.params?.id) {
      return request.params.id
    }

    if (request.params?.documentId) {
      return request.params.documentId
    }

    if (response?.id) {
      return response.id
    }

    if (response?.documentId) {
      return response.documentId
    }

    return undefined
  }
}
