import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../../users/entities/user.entity';

const usedTokens = new Set<string>();

@Controller('module/auth')
export class PasswordResetController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    const user = await this.users.findOneBy({ email: body.email });
    if (user) {
      const token = this.jwt.sign({ sub: user.id, purpose: 'password-reset' }, { expiresIn: '1h' });
      void token;
    }
    return { message: 'If the email exists, a reset link has been sent.' };
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    if (!body.newPassword || body.newPassword.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    if (usedTokens.has(body.token)) throw new BadRequestException('Token has already been used');
    let payload: { sub: string; purpose: string };
    try { payload = this.jwt.verify(body.token); } catch { throw new BadRequestException('Token is expired or invalid'); }
    if (payload.purpose !== 'password-reset') throw new BadRequestException('Invalid token');
    const hash = await bcrypt.hash(body.newPassword, 12);
    await this.users.update(payload.sub, { passwordHash: hash });
    usedTokens.add(body.token);
    return { message: 'Password reset successfully' };
  }
}