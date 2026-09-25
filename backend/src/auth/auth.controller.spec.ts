import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'NODE_ENV') return 'test';
      if (key === 'JWT_EXPIRATION') return '15m';
      if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('sets HttpOnly cookies when registering', async () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'Password123!',
      fullName: 'Test User',
    };
    const tokens = {
      access_token: 'jwt-token',
      refresh_token: 'refresh-token',
    };
    const response = { cookie: jest.fn(), clearCookie: jest.fn() };
    mockAuthService.register.mockResolvedValue(tokens);

    const result = await controller.register(registerDto, response as never);

    expect(authService.register).toHaveBeenCalledWith(registerDto);
    expect(result).toEqual(tokens);
    expect(response.cookie).toHaveBeenCalledWith(
      'access_token',
      tokens.access_token,
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
      }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      'refresh_token',
      tokens.refresh_token,
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('sets HttpOnly cookies when logging in', async () => {
    const loginDto = { email: 'test@example.com', password: 'Password123!' };
    const tokens = {
      access_token: 'jwt-token',
      refresh_token: 'refresh-token',
    };
    const response = { cookie: jest.fn(), clearCookie: jest.fn() };
    mockAuthService.login.mockResolvedValue(tokens);

    const result = await controller.login(loginDto, response as never);

    expect(authService.login).toHaveBeenCalledWith(loginDto);
    expect(result).toEqual(tokens);
    expect(response.cookie).toHaveBeenCalledTimes(2);
  });

  it('returns only safe identity fields from /me', () => {
    const result = controller.me({
      user: {
        id: 'user-1',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'user',
        isVerified: true,
        preferredLanguage: 'en',
        twoFactorEnabled: false,
        passwordHash: 'secret-hash',
      },
    } as never);

    expect(result).toEqual({
      id: 'user-1',
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'user',
      isVerified: true,
      preferredLanguage: 'en',
      twoFactorEnabled: false,
    });
  });

  it('clears both cookies on logout', async () => {
    const response = { cookie: jest.fn(), clearCookie: jest.fn() };
    const request = {
      headers: {
        authorization: 'Bearer bearer-token',
        cookie: 'access_token=cookie-token; refresh_token=refresh-token',
        origin: 'http://localhost:3000',
      },
    };

    await controller.logout(request as never, response as never);

    expect(authService.logout).toHaveBeenCalledWith(
      ['bearer-token', 'cookie-token'],
      'refresh-token',
    );
    expect(response.clearCookie).toHaveBeenCalledTimes(2);
  });

  it('clears cookies even if token revocation fails', async () => {
    const response = { cookie: jest.fn(), clearCookie: jest.fn() };
    const request = {
      headers: {
        authorization: 'Bearer bearer-token',
        cookie: 'access_token=cookie-token; refresh_token=refresh-token',
        origin: 'http://localhost:3000',
      },
    };
    mockAuthService.logout.mockRejectedValueOnce(new Error('revoke failed'));

    await expect(
      controller.logout(request as never, response as never),
    ).rejects.toThrow('revoke failed');
    expect(response.clearCookie).toHaveBeenCalledTimes(2);
  });

  it('rejects cookie-authenticated refresh from an untrusted origin', async () => {
    const response = { cookie: jest.fn(), clearCookie: jest.fn() };
    const request = {
      headers: {
        cookie: 'refresh_token=refresh-token',
        origin: 'https://untrusted.example',
      },
    };

    await expect(
      controller.refresh({}, request as never, response as never),
    ).rejects.toThrow('Request origin is not allowed');
    expect(authService.refreshToken).not.toHaveBeenCalled();
  });
});
