import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BruteForceGuard implements CanActivate {
  private failedAttempts = new Map<
    string,
    { count: number; lockUntil?: Date }
  >();
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCK_TIME_MS: number;

  constructor(private readonly configService: ConfigService) {
    const lockMinutes = parseInt(
      this.configService.get<string>('BRUTE_FORCE_LOCK_MINUTES', '15'),
      10,
    );
    this.LOCK_TIME_MS = lockMinutes * 60 * 1000;
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const email = req.body?.email || req.body?.username;

    if (!email) return true;

    const record = this.failedAttempts.get(email);
    if (record && record.lockUntil && record.lockUntil > new Date()) {
      throw new UnauthorizedException(
        'Account locked due to multiple failed login attempts. Please try again later.',
      );
    }

    return true;
  }

  recordFailedLogin(email: string) {
    const record = this.failedAttempts.get(email) || { count: 0 };
    record.count += 1;
    if (record.count >= this.MAX_ATTEMPTS) {
      record.lockUntil = new Date(Date.now() + this.LOCK_TIME_MS);
    }
    this.failedAttempts.set(email, record);
  }

  resetAttempts(email: string) {
    this.failedAttempts.delete(email);
  }
}
