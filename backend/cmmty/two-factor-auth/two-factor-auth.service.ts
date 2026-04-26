import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../src/users/entities/user.entity';
import * as speakeasy from 'speakeasy';

export interface TOTPSecret {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface TOTPEnableDto {
  secret: string;
  token: string;
}

export interface TOTPVerifyDto {
  token: string;
}

@Injectable()
export class TwoFactorAuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  generateTOTPSecret(user: User): TOTPSecret {
    const secret = speakeasy.generateSecret({
      name: `SMALDA (${user.email})`,
      issuer: 'SMALDA',
      length: 32,
    });

    const backupCodes = this.generateBackupCodes();

    return {
      secret: secret.base32,
      qrCodeUrl: secret.otpauth_url,
      backupCodes,
    };
  }

  async enableTwoFactor(userId: string, enableDto: TOTPEnableDto): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const verified = speakeasy.totp.verify({
      secret: enableDto.secret,
      encoding: 'base32',
      token: enableDto.token,
      window: 2,
    });

    if (!verified) {
      throw new UnauthorizedException('Invalid TOTP token');
    }

    await this.userRepository.update(userId, {
      twoFactorSecret: enableDto.secret,
      twoFactorEnabled: true,
      twoFactorBackupCodes: JSON.stringify(this.generateBackupCodes()),
    });

    return this.userRepository.findOne({ where: { id: userId } });
  }

  async verifyTwoFactor(user: User, verifyDto: TOTPVerifyDto): Promise<boolean> {
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: verifyDto.token,
      window: 2,
    });

    if (!verified) {
      const backupCodes = this.parseBackupCodes(user.twoFactorBackupCodes as string);
      const codeIndex = backupCodes.indexOf(verifyDto.token);
      
      if (codeIndex !== -1) {
        backupCodes.splice(codeIndex, 1);
        await this.userRepository.update(user.id, {
          twoFactorBackupCodes: JSON.stringify(backupCodes),
        });
        return true;
      }
    }

    return verified;
  }

  async disableTwoFactor(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    await this.userRepository.update(userId, {
      twoFactorSecret: null,
      twoFactorEnabled: false,
      twoFactorBackupCodes: null,
    });

    return this.userRepository.findOne({ where: { id: userId } });
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  }

  public parseBackupCodes(codes: string): string[] {
    try {
      return JSON.parse(codes);
    } catch {
      return [];
    }
  }

  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const newBackupCodes = this.generateBackupCodes();
    
    await this.userRepository.update(userId, {
      twoFactorBackupCodes: JSON.stringify(newBackupCodes),
    });

    return newBackupCodes;
  }
}
