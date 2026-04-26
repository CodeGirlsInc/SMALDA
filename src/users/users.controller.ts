import { Controller, Patch, Param, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from './users.service';

@Controller('api/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch(':id/role')
  async changeRole(
    @Param('id') id: string,
    @Body('role') role: string,
    @Req() req: any
  ) {
    // An admin cannot demote or change their own role
    if (req.user.id === id) {
      throw new ForbiddenException('An admin cannot change their own role');
    }
    return this.usersService.changeRole(id, role, req.user.id);
  }

  @Patch(':id/verify')
  async verifyUser(@Param('id') id: string) {
    return this.usersService.verifyUser(id);
  }

  @Patch(':id/suspend')
  async suspendUser(
    @Param('id') id: string,
    @Req() req: any
  ) {
    // An admin cannot suspend themselves
    if (req.user.id === id) {
      throw new ForbiddenException('An admin cannot suspend themselves');
    }
    return this.usersService.suspendUser(id);
  }
}
