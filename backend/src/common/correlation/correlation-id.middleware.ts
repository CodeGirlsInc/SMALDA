import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';

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
