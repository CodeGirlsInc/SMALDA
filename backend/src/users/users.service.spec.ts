import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and return a user', async () => {
      const userData = { email: 'test@example.com', password: 'password' };
      const user = new User();
      jest.spyOn(userRepository, 'create').mockReturnValue(user);
      jest.spyOn(userRepository, 'save').mockResolvedValue(user);

      const result = await service.create(userData);
      expect(userRepository.create).toHaveBeenCalledWith(userData);
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(result).toEqual(user);
    });
  });

  describe('findById', () => {
    it('should find and return a user by id', async () => {
      const user = new User();
      user.id = '1';
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);

      const result = await service.findById('1');
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(result).toEqual(user);
    });
  });

  describe('findByEmail', () => {
    it('should find and return a user by email', async () => {
      const user = new User();
      user.email = 'test@example.com';
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);

      const result = await service.findByEmail('test@example.com');
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(user);
    });
  });

  describe('update', () => {
    it('should update and return a user', async () => {
      const user = new User();
      user.id = '1';
      const updates = { name: 'New Name' };
      jest.spyOn(userRepository, 'update').mockResolvedValue(undefined);
      jest.spyOn(service, 'findById').mockResolvedValue(user);

      const result = await service.update('1', updates);
      expect(userRepository.update).toHaveBeenCalledWith('1', updates);
      expect(service.findById).toHaveBeenCalledWith('1');
      expect(result).toEqual(user);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a user', async () => {
      jest.spyOn(userRepository, 'softDelete').mockResolvedValue(undefined);

      await service.softDelete('1');
      expect(userRepository.softDelete).toHaveBeenCalledWith('1');
    });
  });

  describe('checkRateLimit()', () => {
    it('should allow first request', () => {
      expect(service.checkRateLimit('user-1')).toBe(true);
    });

    it('should block after exceeding rate limit', () => {
      for (let i = 0; i < 30; i++) {
        service.checkRateLimit('rate-limited-user');
      }
      expect(service.checkRateLimit('rate-limited-user')).toBe(false);
    });

    it('should track different users separately', () => {
      for (let i = 0; i < 30; i++) {
        service.checkRateLimit('user-a');
      }
      expect(service.checkRateLimit('user-a')).toBe(false);
      expect(service.checkRateLimit('user-b')).toBe(true);
    });
  });
});
