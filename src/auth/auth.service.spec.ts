import { AuthService } from './auth.service';

// Mocking dependencies that would typically be injected
const mockUserRepository = {
  findByEmail: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const mockBcrypt = {
  hash: jest.fn(),
  compare: jest.fn(),
};

describe('AuthService', () => {
  let authService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Assuming a generic DI or constructor injection
    authService = new AuthService(mockUserRepository, mockJwtService, mockBcrypt);
  });

  describe('register()', () => {
    it('creates user with bcrypt-hashed password', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue('hashed_password_123');
      mockUserRepository.create.mockReturnValue({ email: 'test@example.com' });
      mockUserRepository.save.mockResolvedValue({ id: 1, email: 'test@example.com' });

      await authService.register('test@example.com', 'password123');

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', expect.any(Number));
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('rejects duplicate email with 409', async () => {
      mockUserRepository.findByEmail.mockResolvedValue({ id: 1, email: 'test@example.com' });

      await expect(authService.register('test@example.com', 'password123')).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  describe('login()', () => {
    it('returns tokens on valid credentials', async () => {
      mockUserRepository.findByEmail.mockResolvedValue({ id: 1, email: 'test@example.com', password: 'hashed_password' });
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwtService.sign.mockReturnValueOnce('access_token_123').mockReturnValueOnce('refresh_token_123');

      const tokens = await authService.login('test@example.com', 'password123');

      expect(tokens).toHaveProperty('accessToken', 'access_token_123');
      expect(tokens).toHaveProperty('refreshToken', 'refresh_token_123');
    });

    it('throws 401 on wrong password', async () => {
      mockUserRepository.findByEmail.mockResolvedValue({ id: 1, email: 'test@example.com', password: 'hashed_password' });
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(authService.login('test@example.com', 'wrong_password')).rejects.toMatchObject({
        status: 401,
      });
    });

    it('throws 401 on unknown email', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login('unknown@example.com', 'password123')).rejects.toMatchObject({
        status: 401,
      });
    });
  });

  describe('refreshToken()', () => {
    it('returns new access token for valid refresh token', async () => {
      mockJwtService.verify.mockReturnValue({ userId: 1 });
      mockUserRepository.findByEmail.mockResolvedValue({ id: 1, email: 'test@example.com' });
      mockJwtService.sign.mockReturnValue('new_access_token_123');

      const tokens = await authService.refreshToken('valid_refresh_token');

      expect(tokens).toHaveProperty('accessToken', 'new_access_token_123');
    });

    it('throws 401 for tampered token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(authService.refreshToken('tampered_token')).rejects.toMatchObject({
        status: 401,
      });
    });
  });

  describe('handleOAuthLogin()', () => {
    it('creates new user on first OAuth login', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({ email: 'oauth@example.com' });
      mockUserRepository.save.mockResolvedValue({ id: 2, email: 'oauth@example.com' });
      mockJwtService.sign.mockReturnValue('oauth_access_token');

      const result = await authService.handleOAuthLogin({ email: 'oauth@example.com', provider: 'google' });

      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result).toHaveProperty('accessToken', 'oauth_access_token');
    });

    it('returns existing user on subsequent logins', async () => {
      mockUserRepository.findByEmail.mockResolvedValue({ id: 2, email: 'oauth@example.com' });
      mockJwtService.sign.mockReturnValue('oauth_access_token');

      const result = await authService.handleOAuthLogin({ email: 'oauth@example.com', provider: 'google' });

      expect(mockUserRepository.save).not.toHaveBeenCalled(); // No new user created
      expect(result).toHaveProperty('accessToken', 'oauth_access_token');
    });
  });
});
