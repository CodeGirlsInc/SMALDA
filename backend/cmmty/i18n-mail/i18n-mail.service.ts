import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { SendMailOptions, Transporter } from 'nodemailer';
import { getTranslations, TranslationType, DEFAULT_LANGUAGE } from './locales';

@Injectable()
export class I18nMailService {
  private readonly logger = new Logger(I18nMailService.name);
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

  async sendWelcome(to: string, name: string, language?: string): Promise<void> {
    const t = getTranslations(language);
    await this.sendMail({
      to,
      subject: t.welcome.subject,
      html: `<p>${t.welcome.greeting(name)}</p><p>${t.welcome.body}</p>`,
    });
  }

  async sendVerificationComplete(
    to: string,
    documentTitle: string,
    txHash: string,
    language?: string,
  ): Promise<void> {
    const t = getTranslations(language);
    await this.sendMail({
      to,
      subject: t.verificationComplete.subject,
      html: t.verificationComplete.body(documentTitle, txHash),
    });
  }

  async sendRiskAlert(
    to: string,
    documentTitle: string,
    flags: string[],
    language?: string,
  ): Promise<void> {
    const t = getTranslations(language);
    await this.sendMail({
      to,
      subject: t.riskAlert.subject,
      html: t.riskAlert.body(documentTitle, flags),
    });
  }
}
