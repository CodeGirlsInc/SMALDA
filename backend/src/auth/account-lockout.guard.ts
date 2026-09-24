import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Locks an account out for a cooldown period after repeated failed
 * login attempts, rather than allowing unlimited retries.
 */
@Injectable()
export class AccountLockoutGuard implements CanActivate {
  private readonly failedAttempts = new Map<string, number>();
  private readonly lockedUntil = new Map<string, number>();
  private readonly maxFailures = 5;
  private readonly lockoutMs = 15 * 60_000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const identifier = request.body?.email ?? request.ip;
    const lockExpiry = this.lockedUntil.get(identifier);

    if (lockExpiry && Date.now() < lockExpiry) {
      throw new ForbiddenException('Account temporarily locked due to repeated failed logins');
    }
    return true;
  }

  recordFailure(identifier: string): void {
    const count = (this.failedAttempts.get(identifier) ?? 0) + 1;
    this.failedAttempts.set(identifier, count);
    if (count >= this.maxFailures) {
      this.lockedUntil.set(identifier, Date.now() + this.lockoutMs);
      this.failedAttempts.delete(identifier);
    }
  }
}
