import { Controller, Get, Delete, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { User } from './entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request & { user?: User }) {
    return this.usersService.findById(req.user!.id);
  }

  @Get('me/export')
  @UseGuards(JwtAuthGuard)
  async exportData(@Req() req: Request & { user?: User }) {
    return this.usersService.exportUserData(req.user!.id);
  }

  @Delete('me/data')
  @UseGuards(JwtAuthGuard)
  async eraseData(@Req() req: Request & { user?: User }) {
    await this.usersService.eraseUserData(req.user!.id);
    return { message: 'Your personal data has been erased.' };
  }
}
