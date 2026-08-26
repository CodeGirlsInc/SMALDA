import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { SendMailOptions, Transporter } from 'nodemailer';
import { UsersService } from '../users/users.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const host = this.configService.get<string>('MAIL_HOST');
    const port = Number(this.configService.get<string>('MAIL_PORT'));
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASSWORD');
    this.from = this.configService.get<string>('MAIL_FROM');

    if (!host || !port || !user || !pass || !this.from) {
      this.logger.warn(
        'SMTP configuration is incomplete; email delivery will be disabled',
      );
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
      this.logger.warn(
        `Skipping email to ${options.to} because SMTP is not configured`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      ...options,
    });
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:6004';
    const verificationUrl = `${appUrl}/api/auth/verify-email?token=${token}`;

    await this.sendMail({
      to,
      subject: 'Verify your new email address',
      text: `Please verify your new email address by clicking the following link:\n\n${verificationUrl}\n\nIf you did not request this change, please ignore this email.`,
      html: `
        <p>Please verify your new email address by clicking the link below:</p>
        <p><a href="${verificationUrl}">Verify Email Address</a></p>
        <p>If you did not request this change, please ignore this email.</p>
      `,
    });
  }

  async sendWelcome(to: string, name: string): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Welcome to Smalda',
      text: `Hi ${name},\n\nThank you for joining Smalda. We are excited to help you secure your land documents.`,
      html: `<p>Hi ${name},</p><p>Thank you for joining Smalda. We are excited to help you secure your land documents.</p>`,
    });
  }

  async sendVerificationComplete(
    to: string,
    documentTitle: string,
    txHash: string,
  ): Promise<void> {
    const user = await this.usersService.findByEmail(to);
    if (!user) {
      this.logger.warn(`User not found for email: ${to}`);
      return;
    }

    await this.sendMail({
      to,
      subject: 'Document Verification Complete',
      text: `Your document "${documentTitle}" has been anchored on the Stellar network.\n\nTransaction hash: ${txHash}\n\nYou can view the transaction via the Stellar Horizon explorer.`,
      html: `
        <p>Your document <strong>${documentTitle}</strong> has been anchored on the Stellar network.</p>
        <p>Transaction hash: <code>${txHash}</code></p>
        <p>You can view the transaction via the Stellar Horizon explorer.</p>
      `,
    });
  }

  async sendRiskAlert(
    to: string,
    documentTitle: string,
    flags: string[],
  ): Promise<void> {
    const user = await this.usersService.findByEmail(to);
    if (!user) {
      this.logger.warn(`User not found for email: ${to}`);
      return;
    }

    const flagList = flags.map((flag) => `<li>${flag}</li>`).join('');
    const flagText = flags.map((flag) => `  - ${flag}`).join('\n');
    await this.sendMail({
      to,
      subject: 'Risk Alert: Document Needs Attention',
      text: `The document "${documentTitle}" triggered the following risk flags:\n\n${flagText}\n\nPlease review the document and supply any missing information.`,
      html: `
        <p>The document <strong>${documentTitle}</strong> triggered the following risk flags:</p>
        <ul>${flagList}</ul>
        <p>Please review the document and supply any missing information.</p>
      `,
    });
  }
}
