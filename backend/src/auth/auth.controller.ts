import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './providers/auth.service';
import { CreateUserDto } from 'src/users/dto/createUser.dto';
import { VerifyEmailDto } from 'src/users/dto/verifyEmail.dto';
import { GetUser } from './decorators/getUser.decorator';
import { User } from 'src/users/entities/user.entity';
import { LocalAuthGuard } from './guards/localAuth.guard';
import { LoginUserDto } from './dto/loginUser.dto';
import { Request } from 'express';
import { IsPublic } from './decorators/public.decorator';
import { RefreshTokenGuard } from './guards/refreshToken.guard';
import { RefreshTokenDto } from './dto/refreshToken.dto';
import { ForgotPasswordDto } from './dto/forgotPassword.dto';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import { ChangePasswordDto } from './dto/changeUserPassword.dto';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // CREATE A NEW USER
  @IsPublic()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  public async createNewUser(@Body() createUserDto: CreateUserDto) {
    return await this.authService.createSinlgeUser(createUserDto);
  }

  // LOGIN USER
  @IsPublic()
  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  public async login(
    @Body() loginUserDto: LoginUserDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return await this.authService.loginUser(loginUserDto, user, req);
  }

  // VERIFY EMAIL
  @IsPublic()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  public async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return await this.authService.verifyEmail(verifyEmailDto);
  }

  // RESEND VERIFY EMAIL
  @Post('resend-verify-email')
  @HttpCode(HttpStatus.OK)
  public async resendVerifyEmail(@GetUser() user: User) {
    return await this.authService.ResendVerifyEmail(user);
  }

  // REFRESH TOKEN
  @IsPublic()
  @Post('refresh-token')
  @UseGuards(RefreshTokenGuard)
  @HttpCode(HttpStatus.OK)
  public async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return await this.authService.refreshToken(refreshTokenDto, user.id, req);
  }

  // LOG OUT
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  public async logout(
    @GetUser() user: User,
    @Body() refreshTokenDto: RefreshTokenDto,
  ) {
    return await this.authService.logout(user.id, refreshTokenDto.refreshToken);
  }

  // LOG OUT ALL SESSIONS
  @Post('logout-all-sessions')
  @HttpCode(HttpStatus.OK)
  public async logoutAllSessions(@GetUser() user: User) {
    return this.authService.logoutAllSessions(user.id);
  }

  // FORGOT PASSWORD
  @IsPublic()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  public async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return await this.authService.forgotPassword(forgotPasswordDto);
  }

  // RESET PASSWORD
  @IsPublic()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  public async resetpassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return await this.authService.resetPassword(resetPasswordDto);
  }

  // CHANGE PASSWORD
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  public async changePassword(
    @GetUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return await this.authService.changePassword(user.email, changePasswordDto);
  }
}
