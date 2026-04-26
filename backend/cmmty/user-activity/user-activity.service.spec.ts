import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserActivity } from './user-activity.entity';
import { UserActivityService } from './user-activity.service';

describe('UserActivityService', () => {
  let service: UserActivityService;

  const mockRepository = {
    findAndCount: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserActivityService,
        {
          provide: getRepositoryToken(UserActivity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UserActivityService>(UserActivityService);
  });

  it('should return paginated activity logs', async () => {
    mockRepository.findAndCount.mockResolvedValue([
      [
        {
          id: '1',
          userId: 'user-1',
          action: 'login',
          metadata: { ip: '127.0.0.1' },
          timestamp: new Date(),
        },
      ],
      1,
    ]);

    const result = await service.getMyActivity('user-1', { page: 1, limit: 10 });

    expect(result.total).toBe(1);
    expect(result.data[0].action).toBe('login');
  });

  it('should apply action filter when provided', async () => {
    mockRepository.findAndCount.mockResolvedValue([[], 0]);

    await service.getMyActivity('user-1', {
      page: 1,
      limit: 10,
      action: 'upload',
    });

    expect(mockRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          action: 'upload',
        }),
      }),
    );
  });
});
