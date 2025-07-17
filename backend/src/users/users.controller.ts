import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';
import { UsersService } from './providers/users.service';
import { GetUser } from 'src/auth/decorators/getUser.decorator';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/updateUser.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/auth/enums/roles.enum';

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET USER PROFILE - USER
  @Get('me')
  @HttpCode(HttpStatus.OK)
  public async getUserProfile(@GetUser() user: User) {
    return await this.usersService.userProfile(user);
  }

  // UPDATE USER OWN PROFILE - USER
  @Patch('me/update')
  public async updateUserProfile(
    @GetUser() user: User,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.usersService.updateUser(user.id, updateUserDto);
  }

  // DELETE USER OWN ACCOUNT - USER
  @Delete('me/delete')
  public async deleteUserAccount(@GetUser() user: User) {
    return await this.usersService.deleteSingleUser(user.id);
  }

  // GET ALL USERS - ADMIN
  @Get()
  @Roles(UserRole.ADMIN)
  public async getAllUsers() {
    return await this.usersService.getAllUsers();
  }

  // GET SINGLE USER - ADMIN
  @Get(':id')
  @Roles(UserRole.ADMIN)
  public async getSingleUser(@Param('id') userId: string) {
    return await this.usersService.getSingleUser(userId);
  }

  // DELETE SINGLE USER - ADMIN
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  public async deleteSingleUser(@Param('id') userId: string) {
    return await this.usersService.deleteSingleUser(userId);
  }
}
