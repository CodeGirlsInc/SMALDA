import { Injectable, type NestMiddleware, Logger } from "@nestjs/common"
import type { Request, Response, NextFunction } from "express"
import type { AccessLogsService } from "../access-logs.service"

export interface RequestWithUser extends Request {
  user?: {
    id: string
    [key: string]: any
  }
}

@Injectable()
export class AccessLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AccessLogMiddleware.name)

  constructor(private readonly accessLogsService: AccessLogsService) {}

  use(req: RequestWithUser, res: Response, next: NextFunction): void {
    const startTime = Date.now()

    // Get IP address (considering proxies)
    const ipAddress = this.getClientIp(req)

    // Log the request after response is sent
    res.on("finish", async () => {
      try {
        const responseTime = Date.now() - startTime

        await this.accessLogsService.create({
          routePath: req.originalUrl || req.url,
          httpMethod: req.method,
          ipAddress,
          userId: req.user?.id,
          userAgent: req.get("User-Agent"),
          statusCode: res.statusCode,
          responseTime,
        })
      } catch (error) {
        this.logger.error("Failed to log access", error.stack)
      }
    })

    next()
  }

  private getClientIp(req: Request): string {
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      (req.headers["x-real-ip"] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      "0.0.0.0"
    )
  }
}
