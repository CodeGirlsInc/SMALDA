import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

const HEADER_NAME = 'x-correlation-id';

/**
 * Propagates a correlation id across dispute, verification, queue and
 * stellar modules so a single request can be traced across logs.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.headers[HEADER_NAME] as string) || randomUUID();
    req.headers[HEADER_NAME] = correlationId;
    res.setHeader(HEADER_NAME, correlationId);
    next();
  }
}
