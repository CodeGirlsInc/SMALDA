import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';

import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { decryptBuffer, encryptBuffer } from '../common/crypto.util';

const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 60_000;

@Injectable()
export class TwoFactorService {
  private readonly attempts = new Map<
    string,
    { count: number; windowStart: number }
  >();

  constructor(private readonly usersService: UsersService) {}

  async setup(user: User) {
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `SMALDA (${user.email})`,
      issuer: 'SMALDA',
    });

    // The TOTP secret is encrypted at rest; only the user gets the plain value.
    const encrypted = encryptBuffer(Buffer.from(secret.base32, 'utf8')).toString(
      'base64',
    );
    await this.usersService.update(user.id, {
      twoFactorSecret: encrypted,
      twoFactorEnabled: false,
    });

    return { secret: secret.base32, otpauthUrl: secret.otpauth_url };
  }

  async confirm(userId: string, code: string) {
    const user = await this.getUserWithSecret(userId);
    this.assertNotRateLimited(userId);

    if (!this.verifyTotp(user, code)) {
      this.recordFailure(userId);
      throw new UnauthorizedException('Invalid two-factor code');
    }

    const backupCodes = Array.from({ length: 8 }, () =>
      randomBytes(4).toString('hex'),
    );
    await this.usersService.update(userId, {
      twoFactorEnabled: true,
      twoFactorBackupCodes: JSON.stringify(backupCodes.map(hashCode)),
    });
    this.clearFailures(userId);

    // The plain backup codes are shown once and stored only as hashes.
    return { enabled: true, backupCodes };
  }

  async challenge(userId: string, code: string) {
    const user = await this.getUserWithSecret(userId);
    this.assertNotRateLimited(userId);

    if (this.verifyTotp(user, code) || (await this.consumeBackupCode(user, code))) {
      this.clearFailures(userId);
      return true;
    }

    this.recordFailure(userId);
    throw new UnauthorizedException('Invalid two-factor code');
  }

  async disable(userId: string, password: string) {
    const user = await this.usersService.findById(userId);
    if (!user?.passwordHash) {
      throw new BadRequestException('Password is not set for this account');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.usersService.update(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null as unknown as undefined,
      twoFactorBackupCodes: null as unknown as undefined,
    });

    return { enabled: false };
  }

  private async getUserWithSecret(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user?.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication is not set up');
    }
    return user;
  }

  private verifyTotp(user: User, code: string): boolean {
    const secret = decryptBuffer(
      Buffer.from(user.twoFactorSecret as string, 'base64'),
    ).toString('utf8');

    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
  }

  private async consumeBackupCode(user: User, code: string): Promise<boolean> {
    const stored: string[] = JSON.parse(user.twoFactorBackupCodes || '[]');
    const index = stored.indexOf(hashCode(code));
    if (index < 0) return false;

    stored.splice(index, 1);
    await this.usersService.update(user.id, {
      twoFactorBackupCodes: JSON.stringify(stored),
    });
    return true;
  }

  private assertNotRateLimited(userId: string): void {
    const entry = this.attempts.get(userId);
    if (!entry) return;

    if (Date.now() - entry.windowStart > ATTEMPT_WINDOW_MS) {
      this.attempts.delete(userId);
      return;
    }

    if (entry.count >= MAX_ATTEMPTS) {
      throw new UnauthorizedException(
        'Too many two-factor attempts. Try again later.',
      );
    }
  }

  private recordFailure(userId: string): void {
    const now = Date.now();
    const entry = this.attempts.get(userId);
    if (!entry || now - entry.windowStart > ATTEMPT_WINDOW_MS) {
      this.attempts.set(userId, { count: 1, windowStart: now });
      return;
    }
    entry.count += 1;
  }

  private clearFailures(userId: string): void {
    this.attempts.delete(userId);
  }
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
