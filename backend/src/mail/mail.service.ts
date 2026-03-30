import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { SendMailOptions, Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from?: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('MAIL_HOST');
    const port = Number(this.configService.get<string>('MAIL_PORT'));
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASSWORD');
    this.from = this.configService.get<string>('MAIL_FROM');

    if (!host || !port || !user || !pass || !this.from) {
      this.logger.warn('SMTP configuration is incomplete; email delivery will be disabled');
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  private async sendMail(options: SendMailOptions) {
    if (!this.transporter) {
      this.logger.warn(`Skipping email to ${options.to} because SMTP is not configured`);
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      ...options,
    });
  }

  async sendWelcome(to: string, name: string): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Welcome to Smalda',
      html: `<p>Hi ${name},</p><p>Thank you for joining Smalda. We are excited to help you secure your land documents.</p>`,
    });
  }

  async sendVerificationComplete(to: string, documentTitle: string, txHash: string): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Document Verification Complete',
      html: `
        <p>Your document <strong>${documentTitle}</strong> has been anchored on the Stellar network.</p>
        <p>Transaction hash: <code>${txHash}</code></p>
        <p>You can view the transaction via the Stellar Horizon explorer.</p>
      `,
    });
  }

  async sendRiskAlert(to: string, documentTitle: string, flags: string[]): Promise<void> {
    const flagList = flags.map((flag) => `<li>${flag}</li>`).join('');
    await this.sendMail({
      to,
      subject: 'Risk Alert: Document Needs Attention',
      html: `
        <p>The document <strong>${documentTitle}</strong> triggered the following risk flags:</p>
        <ul>${flagList}</ul>
        <p>Please review the document and supply any missing information.</p>
      `,
    });
  }

  async sendVerificationEmail(to: string, fullName: string, verificationLink: string): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Verify Your Email - Smalda',
      html: `
        <p>Hi ${fullName},</p>
        <p>Welcome to Smalda! Please verify your email address by clicking the link below:</p>
        <p><a href="${verificationLink}">Verify Email</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create an account, please ignore this email.</p>
      `,
    });
  }

  async sendPasswordResetEmail(to: string, fullName: string, resetLink: string): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Password Reset Request - Smalda',
      html: `
        <p>Hi ${fullName},</p>
        <p>You requested to reset your password. Click the link below to set a new password:</p>
        <p><a href="${resetLink}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
      `,
    });
  }
}
