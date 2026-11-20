import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import { createHash } from 'crypto';

jest.mock('../common/crypto.util', () => ({
  encryptBuffer: (buffer: Buffer) => buffer,
  decryptBuffer: (buffer: Buffer) => buffer,
}));

import { TwoFactorService } from './two-factor.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

const secret = speakeasy.generateSecret({ length: 20 });
const encryptedSecret = Buffer.from(secret.base32, 'utf8').toString('base64');
const backupCode = 'a1b2c3d4';
const hashedBackupCode = createHash('sha256').update(backupCode).digest('hex');

const mockUsersService = {
  findById: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
};

describe('TwoFactorService.disable()', () => {
  let service: TwoFactorService;

  const oauthUser = {
    id: 'oauth-user',
    email: 'oauth@example.com',
    passwordHash: null,
    twoFactorEnabled: true,
    twoFactorSecret: encryptedSecret,
    twoFactorBackupCodes: JSON.stringify([hashedBackupCode]),
  } as unknown as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<TwoFactorService>(TwoFactorService);
    jest.clearAllMocks();
    mockUsersService.findById.mockResolvedValue(oauthUser);
    mockUsersService.update.mockResolvedValue(oauthUser);
  });

  it('lets an OAuth-only user disable 2FA with a current TOTP code', async () => {
    const code = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });

    await expect(service.disable(oauthUser.id, undefined, code)).resolves.toEqual(
      { enabled: false },
    );
    expect(mockUsersService.update).toHaveBeenCalledWith(oauthUser.id, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
    });
  });

  it('lets an OAuth-only user disable 2FA with an unused backup code', async () => {
    await expect(
      service.disable(oauthUser.id, undefined, backupCode),
    ).resolves.toEqual({ enabled: false });
    expect(mockUsersService.update).toHaveBeenCalledWith(oauthUser.id, {
      twoFactorBackupCodes: '[]',
    });
    expect(mockUsersService.update).toHaveBeenCalledWith(oauthUser.id, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
    });
  });

  it('rejects an invalid TOTP code for an OAuth-only user', async () => {
    await expect(
      service.disable(oauthUser.id, undefined, '000000'),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockUsersService.update).not.toHaveBeenCalled();
  });

  it('still requires a password for password-based accounts', async () => {
    const passwordHash = bcrypt.hashSync('Password123!', 4);
    mockUsersService.findById.mockResolvedValue({
      ...oauthUser,
      passwordHash,
    } as User);

    await expect(
      service.disable('password-user', undefined, '123456'),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.disable('password-user', 'wrong-password'),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      service.disable('password-user', 'Password123!'),
    ).resolves.toEqual({ enabled: false });
  });
});
