import { Controller, Get, Post, Query, Req, UseGuards, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User } from '../../users/entities/user.entity';

@Controller('module/auth')
export class EmailVerificationController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  @Post('send-verification')
  @UseGuards(JwtAuthGuard)
  async sendVerification(@Req() req: { user: User }) {
    if (req.user.isVerified) throw new ConflictException('User is already verified');
    const token = this.jwt.sign({ sub: req.user.id, purpose: 'email-verify' }, { expiresIn: '24h' });
    return { message: 'Verification email sent', token };
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    let payload: { sub: string; purpose: string };
    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new BadRequestException('Token is expired or invalid');
    }
    if (payload.purpose !== 'email-verify') throw new BadRequestException('Invalid token purpose');
    const user = await this.users.findOneByOrFail({ id: payload.sub });
    if (user.isVerified) throw new ConflictException('User is already verified');
    await this.users.update(user.id, { isVerified: true });
    return { message: 'Email verified successfully' };
  }
}