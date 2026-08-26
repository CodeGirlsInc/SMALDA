import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleStrategy } from './google.strategy';
import { Profile } from 'passport-google-oauth20';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GOOGLE_CLIENT_ID') return 'test-client-id';
              if (key === 'GOOGLE_CLIENT_SECRET') return 'test-client-secret';
              return null;
            }),
          },
        },
      ],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return the profile', async () => {
      const profile: Profile = {
        id: '1',
        displayName: 'Test User',
        provider: 'google',
        emails: [{ value: 'test@example.com', verified: 'true' }],
      };
      const result = await strategy.validate('token', 'refresh', profile);
      expect(result).toEqual(profile);
    });
  });
});
