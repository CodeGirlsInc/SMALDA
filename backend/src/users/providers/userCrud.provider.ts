import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../dto/createUser.dto';
import { UpdateUserDto } from '../dto/updateUser.dto';
import { HashingProvider } from 'src/auth/providers/hashing.provider';

@Injectable()
export class UserCrudActivitiesProvider {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly hashingProvider: HashingProvider,
  ) {}
  // create single user
  public async createSingleUser(createUserDto: CreateUserDto) {
    const { email, firstName, password, lastName } = createUserDto;

    const existingUser = await this.userRepository.findOne({
      where: {
        email,
      },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const user = this.userRepository.create({
      email,
      firstName,
      lastName,
      password: await this.hashingProvider.hash(password),
    });

    await this.userRepository.save(user);

    return user;
  }

  // update single user
  public async updateSinlgeUser(updateUserDto: UpdateUserDto, userId: string) {
    return updateUserDto;
  }

  // delete single user
  public async deleteSinlgeUser(userId: string) {
    return userId;
  }
}
