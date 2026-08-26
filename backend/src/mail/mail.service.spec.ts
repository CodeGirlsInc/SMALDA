import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { UsersService } from '../users/users.service';

const mockSendMail = jest.fn().mockResolvedValue(undefined);

jest.mock('nodemailer', () => ({
  default: {
    createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
  },
}));

const mockUsersService = {
  findByEmail: jest
    .fn()
    .mockResolvedValue({ id: 'user-1', email: 'test@example.com' }),
};

describe('MailService', () => {
  let service: MailService;

  const createService = async (smtpConfig: Record<string, string> = {}) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => smtpConfig[key] || undefined),
          },
        },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    return module.get<MailService>(MailService);
  };

  describe('with SMTP configured', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      service = await createService({
        MAIL_HOST: 'smtp.test.com',
        MAIL_PORT: '587',
        MAIL_USER: 'user',
        MAIL_PASSWORD: 'pass',
        MAIL_FROM: 'noreply@test.com',
      });
    });

    describe('sendWelcome()', () => {
      it('should send email with both html and text parts', async () => {
        await service.sendWelcome('to@test.com', 'Alice');
        expect(mockSendMail).toHaveBeenCalledTimes(1);
        const options = mockSendMail.mock.calls[0][0];
        expect(options.to).toBe('to@test.com');
        expect(options.subject).toBe('Welcome to Smalda');
        expect(options.html).toBeDefined();
        expect(options.text).toBeDefined();
        expect(options.text).toContain('Alice');
        expect(options.html).toContain('Alice');
      });
    });

    describe('sendVerificationComplete()', () => {
      it('should send email with both html and text parts', async () => {
        await service.sendVerificationComplete(
          'to@test.com',
          'Land Deed',
          'tx-hash-123',
        );
        expect(mockSendMail).toHaveBeenCalledTimes(1);
        const options = mockSendMail.mock.calls[0][0];
        expect(options.to).toBe('to@test.com');
        expect(options.subject).toBe('Document Verification Complete');
        expect(options.html).toContain('Land Deed');
        expect(options.text).toContain('Land Deed');
        expect(options.html).toContain('tx-hash-123');
        expect(options.text).toContain('tx-hash-123');
      });

      it('should not send if user not found', async () => {
        mockUsersService.findByEmail.mockResolvedValueOnce(null);
        await service.sendVerificationComplete(
          'unknown@test.com',
          'Doc',
          'tx',
        );
        expect(mockSendMail).not.toHaveBeenCalled();
      });
    });

    describe('sendRiskAlert()', () => {
      it('should send email with both html and text parts including flags', async () => {
        await service.sendRiskAlert('to@test.com', 'Suspicious Doc', [
          'forged signature',
          'expired date',
        ]);
        expect(mockSendMail).toHaveBeenCalledTimes(1);
        const options = mockSendMail.mock.calls[0][0];
        expect(options.to).toBe('to@test.com');
        expect(options.subject).toBe('Risk Alert: Document Needs Attention');
        expect(options.html).toContain('forged signature');
        expect(options.text).toContain('forged signature');
        expect(options.html).toContain('expired date');
        expect(options.text).toContain('expired date');
      });
    });
  });

  describe('without SMTP configured', () => {
    beforeEach(async () => {
      service = await createService({});
    });

    it('should not throw when sending without transport', async () => {
      await expect(
        service.sendWelcome('to@test.com', 'Bob'),
      ).resolves.toBeUndefined();
    });
  });
});
