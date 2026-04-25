import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPrefsService } from './notification-prefs.service';
import { NotificationPrefs } from './notification-prefs.entity';

describe('NotificationPrefsService', () => {
  let service: NotificationPrefsService;
  let repository: Repository<NotificationPrefs>;

  const mockRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPrefsService,
        {
          provide: getRepositoryToken(NotificationPrefs),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<NotificationPrefsService>(NotificationPrefsService);
    repository = module.get<Repository<NotificationPrefs>>(
      getRepositoryToken(NotificationPrefs),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPreferences', () => {
    it('should return existing preferences', async () => {
      const userId = 'user-123';
      const existingPrefs = {
        userId,
        riskAlert: true,
        verificationComplete: false,
        weeklyDigest: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(existingPrefs);

      const result = await service.getPreferences(userId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { userId } });
      expect(result).toEqual(existingPrefs);
    });

    it('should create default preferences when none exist', async () => {
      const userId = 'user-123';
      const defaultPrefs = {
        userId,
        riskAlert: true,
        verificationComplete: true,
        weeklyDigest: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(defaultPrefs);
      mockRepository.save.mockResolvedValue(defaultPrefs);

      const result = await service.getPreferences(userId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { userId } });
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId,
        riskAlert: true,
        verificationComplete: true,
        weeklyDigest: true,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(defaultPrefs);
      expect(result).toEqual(defaultPrefs);
    });
  });

  describe('updatePreferences', () => {
    it('should update existing preferences', async () => {
      const userId = 'user-123';
      const existingPrefs = {
        userId,
        riskAlert: true,
        verificationComplete: true,
        weeklyDigest: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updateDto = {
        riskAlert: false,
        weeklyDigest: false,
      };

      const updatedPrefs = {
        ...existingPrefs,
        ...updateDto,
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(existingPrefs);
      mockRepository.save.mockResolvedValue(updatedPrefs);

      const result = await service.updatePreferences(userId, updateDto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { userId } });
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          riskAlert: false,
          verificationComplete: true,
          weeklyDigest: false,
        }),
      );
      expect(result).toEqual(updatedPrefs);
    });
  });

  describe('shouldSendRiskAlert', () => {
    it('should return true when risk alert preference is enabled', async () => {
      const userId = 'user-123';
      const prefs = {
        userId,
        riskAlert: true,
        verificationComplete: true,
        weeklyDigest: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(prefs);

      const result = await service.shouldSendRiskAlert(userId);

      expect(result).toBe(true);
    });

    it('should return false when risk alert preference is disabled', async () => {
      const userId = 'user-123';
      const prefs = {
        userId,
        riskAlert: false,
        verificationComplete: true,
        weeklyDigest: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(prefs);

      const result = await service.shouldSendRiskAlert(userId);

      expect(result).toBe(false);
    });
  });

  describe('shouldSendVerificationComplete', () => {
    it('should return true when verification complete preference is enabled', async () => {
      const userId = 'user-123';
      const prefs = {
        userId,
        riskAlert: true,
        verificationComplete: true,
        weeklyDigest: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(prefs);

      const result = await service.shouldSendVerificationComplete(userId);

      expect(result).toBe(true);
    });

    it('should return false when verification complete preference is disabled', async () => {
      const userId = 'user-123';
      const prefs = {
        userId,
        riskAlert: true,
        verificationComplete: false,
        weeklyDigest: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(prefs);

      const result = await service.shouldSendVerificationComplete(userId);

      expect(result).toBe(false);
    });
  });

  describe('shouldSendWeeklyDigest', () => {
    it('should return true when weekly digest preference is enabled', async () => {
      const userId = 'user-123';
      const prefs = {
        userId,
        riskAlert: true,
        verificationComplete: true,
        weeklyDigest: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(prefs);

      const result = await service.shouldSendWeeklyDigest(userId);

      expect(result).toBe(true);
    });

    it('should return false when weekly digest preference is disabled', async () => {
      const userId = 'user-123';
      const prefs = {
        userId,
        riskAlert: true,
        verificationComplete: true,
        weeklyDigest: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(prefs);

      const result = await service.shouldSendWeeklyDigest(userId);

      expect(result).toBe(false);
    });
  });
});
