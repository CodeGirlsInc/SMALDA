import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../src/users/entities/user.entity';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class PasswordChangeService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate current password
    if (!user.passwordHash) {
      throw new BadRequestException('User does not have a password set');
    }

    const passwordMatches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);

    // Update password
    await this.userRepository.update(userId, { passwordHash: newPasswordHash });

    return { message: 'Password changed successfully' };
  }
}