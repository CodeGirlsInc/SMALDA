import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../src/users/entities/user.entity';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@Injectable()
export class UserProfileService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async updateProfile(userId: string, dto: UpdateUserProfileDto): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.fullName !== undefined) {
      user.fullName = dto.fullName;
    }

    const updatedUser = await this.userRepository.save(user);

    // Return user object excluding password hash
    const { passwordHash, ...result } = updatedUser;
    return result;
  }

  async getProfile(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash, ...result } = user;
    return result;
  }
}