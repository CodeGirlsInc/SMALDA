import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GithubStrategy } from './github.strategy';
import { Profile } from 'passport-github2';

describe('GithubStrategy', () => {
  let strategy: GithubStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GITHUB_CLIENT_ID') return 'test-client-id';
              if (key === 'GITHUB_CLIENT_SECRET') return 'test-client-secret';
              return null;
            }),
          },
        },
      ],
    }).compile();

    strategy = module.get<GithubStrategy>(GithubStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return the profile', async () => {
      const profile: Profile = {
        id: '1',
        displayName: 'Test User',
        provider: 'github',
        emails: [{ value: 'test@example.com' }],
      };
      const result = await strategy.validate('token', 'refresh', profile);
      expect(result).toEqual(profile);
    });
  });
});
