import { Controller, Get, Patch, Req, UseGuards, Body } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { User } from '../../src/users/entities/user.entity';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@Controller('users')
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.userProfileService.getProfile(userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateProfile(@Req() req: AuthenticatedRequest, @Body() dto: UpdateUserProfileDto) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.userProfileService.updateProfile(userId, dto);
  }
}