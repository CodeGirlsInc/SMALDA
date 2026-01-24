import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class StellarLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(StellarLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body } = request;
    const userAgent = request.get('User-Agent') || '';
    const ip = request.ip || request.connection.remoteAddress;

    const startTime = Date.now();
    
    this.logger.log(
      `Incoming Request: ${method} ${url} - IP: ${ip} - User-Agent: ${userAgent}`,
    );

    if (body && Object.keys(body).length > 0) {
      // Log sensitive data safely
      const sanitizedBody = { ...body };
      if (sanitizedBody.sourceSecretKey) {
        sanitizedBody.sourceSecretKey = '[REDACTED]';
      }
      if (sanitizedBody.secretKey) {
        sanitizedBody.secretKey = '[REDACTED]';
      }
      this.logger.debug(`Request Body: ${JSON.stringify(sanitizedBody)}`);
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          this.logger.log(
            `Outgoing Response: ${method} ${url} - Status: Success - Duration: ${duration}ms`,
          );
          
          // Log response data safely
          if (data && typeof data === 'object') {
            const sanitizedData = { ...data };
            if (sanitizedData.secretKey) {
              sanitizedData.secretKey = '[REDACTED]';
            }
            if (sanitizedData.sourceSecretKey) {
              sanitizedData.sourceSecretKey = '[REDACTED]';
            }
            this.logger.debug(`Response Body: ${JSON.stringify(sanitizedData)}`);
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `Outgoing Response: ${method} ${url} - Status: Error - Duration: ${duration}ms - Error: ${error.message}`,
            error.stack,
          );
        },
      }),
    );
  }
}
