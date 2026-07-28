import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

@Injectable()
export class BruteForceGuard implements CanActivate {
  private readonly logger = new Logger(BruteForceGuard.name);
  private readonly attempts = new Map<string, AttemptRecord>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly blockDurationMs: number;

  constructor(private readonly configService: ConfigService) {
    this.maxAttempts = this.configService.get<number>('BRUTE_MAX_ATTEMPTS') || 5;
    this.windowMs = this.configService.get<number>('BRUTE_WINDOW_MS') || 15 * 60 * 1000;
    this.blockDurationMs = this.configService.get<number>('BRUTE_BLOCK_MS') || 60 * 60 * 1000;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = this.getKey(request);

    const record = this.attempts.get(key);

    if (record?.blockedUntil && Date.now() < record.blockedUntil) {
      const retryAfter = Math.ceil((record.blockedUntil - Date.now()) / 1000);
      this.logger.warn(`Brute-force block active for ${key}, retry after ${retryAfter}s`);
      throw new HttpException(
        { message: 'Too many attempts. Please try again later.', retryAfter },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (record?.blockedUntil && Date.now() >= record.blockedUntil) {
      this.attempts.delete(key);
    }

    return true;
  }

  recordFailedAttempt(request: Request): void {
    const key = this.getKey(request);
    const now = Date.now();
    const record = this.attempts.get(key);

    if (!record || now - record.firstAttempt > this.windowMs) {
      this.attempts.set(key, { count: 1, firstAttempt: now });
      return;
    }

    record.count++;

    if (record.count >= this.maxAttempts) {
      record.blockedUntil = now + this.blockDurationMs;
      this.logger.warn(`Brute-force block triggered for ${key} after ${record.count} attempts`);
    }
  }

  resetAttempts(request: Request): void {
    const key = this.getKey(request);
    this.attempts.delete(key);
  }

  private getKey(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : request.ip;
    return ip || 'unknown';
  }
}
