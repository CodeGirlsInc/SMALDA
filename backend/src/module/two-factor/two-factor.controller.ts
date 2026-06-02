import { Body, Controller, Post, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { authenticator } from 'otplib';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User } from '../../users/entities/user.entity';

function generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 10).toUpperCase());
}

@Controller('module/auth/2fa')
@UseGuards(JwtAuthGuard)
export class TwoFactorController {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  @Post('setup')
  async setup(@Req() req: { user: User }) {
    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(req.user.email, 'SMALDA', secret);
    const backupCodes = generateBackupCodes();
    await this.users.update(req.user.id, {
      twoFactorSecret: secret,
      twoFactorBackupCodes: JSON.stringify(backupCodes),
    });
    return { otpAuthUrl, backupCodes };
  }

  @Post('verify')
  async verify(@Req() req: { user: User }, @Body() body: { code: string }) {
    const user = await this.users.findOneByOrFail({ id: req.user.id });
    if (!user.twoFactorSecret) throw new BadRequestException('2FA setup not initiated');
    if (!authenticator.verify({ token: body.code, secret: user.twoFactorSecret })) {
      throw new BadRequestException('Invalid or expired TOTP code');
    }
    await this.users.update(user.id, { twoFactorEnabled: true });
    return { message: '2FA enabled successfully' };
  }

  @Post('disable')
  async disable(@Req() req: { user: User }, @Body() body: { code: string }) {
    const user = await this.users.findOneByOrFail({ id: req.user.id });
    if (!user.twoFactorSecret || !authenticator.verify({ token: body.code, secret: user.twoFactorSecret })) {
      throw new BadRequestException('Invalid or expired TOTP code');
    }
    await this.users.update(user.id, { twoFactorEnabled: false, twoFactorSecret: undefined });
    return { message: '2FA disabled successfully' };
  }
}