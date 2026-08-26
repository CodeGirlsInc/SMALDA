import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const LOCKOUT_PREFIX = 'brute:lock:';
const ATTEMPTS_PREFIX = 'brute:attempts:';
const MAX_ATTEMPTS = 5;

@Injectable()
export class BruteForceGuard implements CanActivate {
  private readonly redis: Redis;
  private readonly lockTimeSeconds: number;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST') || '127.0.0.1';
    const port = Number(this.configService.get<string>('REDIS_PORT') || '6379');
    const password =
      this.configService.get<string>('REDIS_PASSWORD') || undefined;
    this.redis = new Redis({ host, port, password });

    const lockMinutes = parseInt(
      this.configService.get<string>('BRUTE_FORCE_LOCK_MINUTES', '15'),
      10,
    );
    this.lockTimeSeconds = lockMinutes * 60;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const email = req.body?.email || req.body?.username;

    if (!email) return true;

    const lockKey = `${LOCKOUT_PREFIX}${email}`;
    const isLocked = await this.redis.get(lockKey);
    if (isLocked) {
      throw new UnauthorizedException(
        'Account locked due to multiple failed login attempts. Please try again later.',
      );
    }

    return true;
  }

  async recordFailedLogin(email: string): Promise<void> {
    const attemptsKey = `${ATTEMPTS_PREFIX}${email}`;
    const count = await this.redis.incr(attemptsKey);
    await this.redis.expire(attemptsKey, this.lockTimeSeconds);

    if (count >= MAX_ATTEMPTS) {
      const lockKey = `${LOCKOUT_PREFIX}${email}`;
      await this.redis.setex(lockKey, this.lockTimeSeconds, 'locked');
    }
  }

  async resetAttempts(email: string): Promise<void> {
    await this.redis.del(`${ATTEMPTS_PREFIX}${email}`, `${LOCKOUT_PREFIX}${email}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
