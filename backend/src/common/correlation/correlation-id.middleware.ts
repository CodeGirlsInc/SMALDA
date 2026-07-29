import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { randomUUID } from 'crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers[CORRELATION_ID_HEADER] as string) || randomUUID();
    req.headers[CORRELATION_ID_HEADER] = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();


import {
  correlationIdStorage,
  generateCorrelationId,
} from './correlation-id.storage';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Attaches a correlation ID to every incoming request. Honors an inbound
 * X-Request-Id header when present; otherwise generates a UUID. The same ID
 * is echoed back on the response as X-Request-Id and stored in async local
 * storage so that Winston includes it on every log line for the request.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = generateCorrelationId(req.headers['x-request-id']);

    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    correlationIdStorage.run(requestId, () => {
      next();
    });

  }
}
