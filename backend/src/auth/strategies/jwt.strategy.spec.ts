import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../users/entities/user.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return the user if found', async () => {
      const user = new User();
      user.id = '1';
      const payload = { sub: '1', email: 'test@example.com' };
      jest.spyOn(usersService, 'findById').mockResolvedValue(user);

      const result = await strategy.validate(payload);

      expect(usersService.findById).toHaveBeenCalledWith(payload.sub);
      expect(result).toEqual(user);
    });

    it('should throw an UnauthorizedException if user is not found', async () => {
      const payload = { sub: '1', email: 'test@example.com' };
      jest.spyOn(usersService, 'findById').mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
