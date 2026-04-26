import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { User } from '../../src/users/entities/user.entity';
import { PasswordResetToken } from './password-reset-token.entity';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetRepository: Repository<PasswordResetToken>,
  ) {}

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const email = dto.email?.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email } });

    if (user) {
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await this.passwordResetRepository.save(
        this.passwordResetRepository.create({
          token,
          user,
          expiresAt,
          used: false,
        }),
      );
    }

    return {
      message:
        'If the email is registered, password reset instructions have been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const token = dto.token?.trim();
    const resetRecord = await this.passwordResetRepository.findOne({
      where: { token },
      relations: ['user'],
    });

    if (
      !resetRecord ||
      resetRecord.used ||
      resetRecord.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepository.update(resetRecord.user.id, { passwordHash });

    resetRecord.used = true;
    await this.passwordResetRepository.save(resetRecord);

    return { message: 'Password reset successfully' };
  }
}
