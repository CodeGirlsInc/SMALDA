import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Repository } from 'typeorm';
import { FindOneUserByIdProvider } from './findOneUserById.provider';

@Injectable()
export class DeleteOneUserProvider {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    private readonly findOneUserByIdProvider: FindOneUserByIdProvider,
  ) {}

  public async deleteUser(id: string) {
    try {
      const result = await this.usersRepository.delete(id);

      if (result.affected === 0) {
        return {
          success: false,
          message: 'User not found or already deleted',
        };
      }

      return {
        success: true,
        message: 'User deleted successfully',
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to delete user due to server error',
      );
    }
  }
}
