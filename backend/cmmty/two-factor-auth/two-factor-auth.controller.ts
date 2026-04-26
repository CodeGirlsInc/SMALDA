import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { TwoFactorAuthService, TOTPSecret, TOTPEnableDto, TOTPVerifyDto } from './two-factor-auth.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { User } from '../../src/users/entities/user.entity';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@Controller('auth/2fa')
@UseGuards(JwtAuthGuard)
export class TwoFactorAuthController {
  constructor(private readonly twoFactorAuthService: TwoFactorAuthService) {}

  @Post('generate')
  async generateTOTPSecret(@Req() req: AuthenticatedRequest): Promise<TOTPSecret> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    return this.twoFactorAuthService.generateTOTPSecret(user);
  }

  @Post('enable')
  async enableTwoFactor(
    @Req() req: AuthenticatedRequest,
    @Body() enableDto: TOTPEnableDto,
  ): Promise<{ message: string; user: Partial<User> }> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    const updatedUser = await this.twoFactorAuthService.enableTwoFactor(user.id, enableDto);

    return {
      message: 'Two-factor authentication enabled successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        twoFactorEnabled: updatedUser.twoFactorEnabled,
      },
    };
  }

  @Post('verify')
  async verifyTwoFactor(
    @Req() req: AuthenticatedRequest,
    @Body() verifyDto: TOTPVerifyDto,
  ): Promise<{ valid: boolean; message: string }> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const isValid = await this.twoFactorAuthService.verifyTwoFactor(user, verifyDto);

    return {
      valid: isValid,
      message: isValid ? 'Two-factor authentication verified' : 'Invalid TOTP token',
    };
  }

  @Post('disable')
  async disableTwoFactor(@Req() req: AuthenticatedRequest): Promise<{ message: string }> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    await this.twoFactorAuthService.disableTwoFactor(user.id);

    return {
      message: 'Two-factor authentication disabled successfully',
    };
  }

  @Get('backup-codes')
  async getBackupCodes(@Req() req: AuthenticatedRequest): Promise<{ backupCodes: string[] }> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const backupCodes = this.twoFactorAuthService.parseBackupCodes(user.twoFactorBackupCodes || '[]');

    return { backupCodes };
  }

  @Post('backup-codes/regenerate')
  async regenerateBackupCodes(@Req() req: AuthenticatedRequest): Promise<{ backupCodes: string[] }> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const backupCodes = await this.twoFactorAuthService.regenerateBackupCodes(user.id);

    return { backupCodes };
  }
}
