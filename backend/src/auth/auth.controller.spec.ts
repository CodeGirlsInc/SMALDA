import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ConfigService } from '@nestjs/config';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    createOAuthExchangeCode: jest.fn().mockResolvedValue('exchange-code'),
    handleOAuthLogin: jest.fn(),
    logout: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('development') },
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

  describe('register', () => {
    it('should call authService.register with the provided dto', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      };
      const token = { access_token: 'jwt-token' };
      mockAuthService.register.mockResolvedValue(token);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(token);
    });
  });

  it('sets the secure session cookie when registering', async () => {
    const registerDto = {
      email: 'cookie@example.com',
      password: 'password123',
      fullName: 'Cookie User',
    };
    mockAuthService.register.mockResolvedValue({ access_token: 'jwt-token' });
    const response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as any;

    await controller.register(registerDto, response);

    expect(response.cookie).toHaveBeenCalledWith(
      'smalda_access_token',
      'jwt-token',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
      }),
    );
  });

  describe('login', () => {
    it('should call authService.login with the provided dto', async () => {
      const loginDto = { email: 'test@example.com', password: 'password123' };
      const token = { access_token: 'jwt-token', refresh_token: 'refresh-token' };
      mockAuthService.login.mockResolvedValue(token);

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(token);
    });
  });

  it('clears the session cookie when the access token is already expired', async () => {
    const response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as any;

    await controller.logout({ headers: {} } as any, response);

    expect(response.clearCookie).toHaveBeenCalledWith(
      'smalda_access_token',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    expect(response.clearCookie).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
  });
});
