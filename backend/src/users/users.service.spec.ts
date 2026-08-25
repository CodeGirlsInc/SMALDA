import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

const mockRepo = () => ({
  create: jest.fn().mockReturnValue({ id: 'u-1', email: 'test@example.com' }),
  save: jest.fn().mockResolvedValue({ id: 'u-1', email: 'test@example.com' }),
  findOne: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
});

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo() },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
