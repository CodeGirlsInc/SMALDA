import { Controller, Get, Patch, Delete, Body, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

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

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Req() req: Request & { user?: User },
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(req.user!.id, dto);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Req() req: Request & { user?: User }) {
    await this.usersService.softDelete(req.user!.id);
    return { message: 'Account deleted successfully' };
  }
}
