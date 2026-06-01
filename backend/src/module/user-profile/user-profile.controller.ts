import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User } from '../../users/entities/user.entity';

@Controller('module/users')
@UseGuards(JwtAuthGuard)
export class UserProfileController {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  @Get('me')
  getProfile(@Req() req: { user: User }) {
    const { passwordHash, twoFactorSecret, twoFactorBackupCodes, ...profile } = req.user;
    void passwordHash; void twoFactorSecret; void twoFactorBackupCodes;
    return profile;
  }

  @Patch('me')
  async updateProfile(
    @Req() req: { user: User },
    @Body() body: { fullName?: string; email?: string },
  ) {
    await this.users.update(req.user.id, body);
    const updated = await this.users.findOneByOrFail({ id: req.user.id });
    const { passwordHash, twoFactorSecret, twoFactorBackupCodes, ...profile } = updated;
    void passwordHash; void twoFactorSecret; void twoFactorBackupCodes;
    return profile;
  }
}