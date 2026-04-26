import { Controller, Post, Req, UseGuards, Body } from '@nestjs/common';
import { PasswordChangeService } from './password-change.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { User } from '../../src/users/entities/user.entity';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@Controller('auth')
export class PasswordChangeController {
  constructor(private readonly passwordChangeService: PasswordChangeService) {}

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@Req() req: AuthenticatedRequest, @Body() dto: ChangePasswordDto) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.passwordChangeService.changePassword(userId, dto);
  }
}