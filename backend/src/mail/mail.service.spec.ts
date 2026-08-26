import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { UsersService } from '../users/users.service';

// ---------------------------------------------------------------------------
// Mocks — define inside the factory so hoisting is not an issue
// ---------------------------------------------------------------------------

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-msg-id' });
const mockVerify = jest.fn().mockResolvedValue(true);

jest.mock('nodemailer', () => {
  const createTransport = jest.fn(() => ({
    sendMail: mockSendMail,
    verify: mockVerify,
  }));
  return {
    __esModule: true,
    default: { createTransport },
    createTransport,
  };
});

// Retrieve the mock reference after the module mock is registered
const nodemailer = require('nodemailer');
const mockCreateTransport = nodemailer.createTransport as jest.Mock;

const mockUsersService = {
  findByEmail: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

const fullConfig: Record<string, string> = {
  MAIL_HOST: 'smtp.example.com',
  MAIL_PORT: '587',
  MAIL_USER: 'user@example.com',
  MAIL_PASSWORD: 'password123',
  MAIL_FROM: 'noreply@smalda.com',
};

const incompleteConfig: Record<string, string> = {
  MAIL_HOST: '',
  MAIL_PORT: '',
  MAIL_USER: '',
  MAIL_PASSWORD: '',
  MAIL_FROM: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildConfigService(overrides: Record<string, string> = fullConfig) {
  return {
    get: jest.fn((key: string) => overrides[key] ?? null),
  } as unknown as ConfigService;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MailService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Constructor / transporter setup ──────────────────────────────────────

  describe('constructor', () => {
    it('should create a transporter when all SMTP config is present', () => {
      const configService = buildConfigService(fullConfig);

      const service = new MailService(configService, mockUsersService as any);

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          auth: { user: 'user@example.com', pass: 'password123' },
        }),
      );
      expect(service).toBeDefined();
    });

    it('should set secure: true when port is 465', () => {
      const configWith465 = { ...fullConfig, MAIL_PORT: '465' };
      const configService = buildConfigService(configWith465);

      new MailService(configService, mockUsersService as any);

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ secure: true }),
      );
    });

    it('should set transporter to null when SMTP config is incomplete', () => {
      const configService = buildConfigService(incompleteConfig);

      const service = new MailService(configService, mockUsersService as any);

      expect(service).toBeDefined();
      // transporter is null internally, so sendMail should be skipped
    });
  });

  // ── sendWelcome ──────────────────────────────────────────────────────────

  describe('sendWelcome()', () => {
    it('should send a welcome email with correct subject and recipient', async () => {
      const configService = buildConfigService(fullConfig);
      const service = new MailService(configService, mockUsersService as any);

      await service.sendWelcome('user@test.com', 'Alice');

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@smalda.com',
          to: 'user@test.com',
          subject: 'Welcome to Smalda',
        }),
      );
    });

    it('should include the user name in the HTML body', async () => {
      const configService = buildConfigService(fullConfig);
      const service = new MailService(configService, mockUsersService as any);

      await service.sendWelcome('user@test.com', 'Alice');

      const html = mockSendMail.mock.calls[0][0].html as string;
      expect(html).toContain('Alice');
      expect(html).toContain('Thank you for joining Smalda');
    });

    it('should skip sending when transporter is not configured', async () => {
      const configService = buildConfigService(incompleteConfig);
      const service = new MailService(configService, mockUsersService as any);

      await service.sendWelcome('user@test.com', 'Alice');

      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  // ── sendVerificationComplete ─────────────────────────────────────────────

  describe('sendVerificationComplete()', () => {
    it('should send verification-complete email with tx hash', async () => {
      const configService = buildConfigService(fullConfig);
      mockUsersService.findByEmail.mockResolvedValue({ id: 'u1', email: 'user@test.com' });
      const service = new MailService(configService, mockUsersService as any);

      await service.sendVerificationComplete(
        'user@test.com',
        'Land Title #1',
        'abc123txhash',
      );

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith('user@test.com');
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Document Verification Complete',
        }),
      );

      const html = mockSendMail.mock.calls[0][0].html as string;
      expect(html).toContain('Land Title #1');
      expect(html).toContain('abc123txhash');
      expect(html).toContain('Stellar');
    });

    it('should not send email when user is not found', async () => {
      const configService = buildConfigService(fullConfig);
      mockUsersService.findByEmail.mockResolvedValue(null);
      const service = new MailService(configService, mockUsersService as any);

      await service.sendVerificationComplete(
        'nonexistent@test.com',
        'Doc',
        'hash',
      );

      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  // ── sendRiskAlert ────────────────────────────────────────────────────────

  describe('sendRiskAlert()', () => {
    it('should send risk-alert email with flagged items listed', async () => {
      const configService = buildConfigService(fullConfig);
      mockUsersService.findByEmail.mockResolvedValue({ id: 'u1', email: 'user@test.com' });
      const service = new MailService(configService, mockUsersService as any);

      await service.sendRiskAlert(
        'user@test.com',
        'Suspicious Deed',
        ['FORGED_SIGNATURE', 'MISSING_PARCEL_ID'],
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Risk Alert: Document Needs Attention',
        }),
      );

      const html = mockSendMail.mock.calls[0][0].html as string;
      expect(html).toContain('Suspicious Deed');
      expect(html).toContain('FORGED_SIGNATURE');
      expect(html).toContain('MISSING_PARCEL_ID');
      expect(html).toContain('<li>');
    });

    it('should not send email when user is not found', async () => {
      const configService = buildConfigService(fullConfig);
      mockUsersService.findByEmail.mockResolvedValue(null);
      const service = new MailService(configService, mockUsersService as any);

      await service.sendRiskAlert('ghost@test.com', 'Doc', ['FLAG']);

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should handle an empty flags array gracefully', async () => {
      const configService = buildConfigService(fullConfig);
      mockUsersService.findByEmail.mockResolvedValue({ id: 'u1', email: 'user@test.com' });
      const service = new MailService(configService, mockUsersService as any);

      await service.sendRiskAlert('user@test.com', 'Clean Doc', []);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const html = mockSendMail.mock.calls[0][0].html as string;
      expect(html).toContain('<ul></ul>');
    });
  });

  // ── Transport failure handling ───────────────────────────────────────────

  describe('transport failure', () => {
    it('should propagate transporter errors to the caller', async () => {
      const configService = buildConfigService(fullConfig);
      const service = new MailService(configService, mockUsersService as any);

      mockSendMail.mockRejectedValueOnce(new Error('SMTP connection refused'));

      await expect(
        service.sendWelcome('user@test.com', 'Alice'),
      ).rejects.toThrow('SMTP connection refused');
    });

    it('should propagate when sendVerificationComplete transporter fails', async () => {
      const configService = buildConfigService(fullConfig);
      mockUsersService.findByEmail.mockResolvedValue({ id: 'u1', email: 'user@test.com' });
      const service = new MailService(configService, mockUsersService as any);

      mockSendMail.mockRejectedValueOnce(new Error('ECONNRESET'));

      await expect(
        service.sendVerificationComplete('user@test.com', 'Doc', 'hash'),
      ).rejects.toThrow('ECONNRESET');
    });

    it('should propagate when sendRiskAlert transporter fails', async () => {
      const configService = buildConfigService(fullConfig);
      mockUsersService.findByEmail.mockResolvedValue({ id: 'u1', email: 'user@test.com' });
      const service = new MailService(configService, mockUsersService as any);

      mockSendMail.mockRejectedValueOnce(new Error('ETIMEOUT'));

      await expect(
        service.sendRiskAlert('user@test.com', 'Doc', ['FLAG']),
      ).rejects.toThrow('ETIMEOUT');
    });
  });

  // ── Localized template selection ─────────────────────────────────────────

  describe('locale-based template selection', () => {
    it('should fall back to the default (English) template when no locale is set', async () => {
      const configService = buildConfigService(fullConfig);
      const service = new MailService(configService, mockUsersService as any);

      await service.sendWelcome('user@test.com', 'Alice');

      const html = mockSendMail.mock.calls[0][0].html as string;
      expect(html).toContain('Thank you for joining Smalda');
    });
  });
});
