import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { NotificationLog } from './entities/notification-log.entity';
import { NotificationType } from './enums/notification-type.enum';

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: Transporter;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(NotificationLog)
    private readonly notificationLogRepository: Repository<NotificationLog>,
  ) {}

  onModuleInit() {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<number>('SMTP_PORT') === 465,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendVerificationComplete(
    to: string,
    documentId: string,
    transactionId: string,
  ): Promise<void> {
    const subject = 'Document Verification Complete';
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2e7d32;">Document Successfully Anchored</h2>
          <p>Your document has been verified and anchored on the Stellar blockchain.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold; width: 40%;">Document ID</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${documentId}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">Transaction ID</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${transactionId}</td>
            </tr>
          </table>
          <p style="margin-top: 24px; font-size: 12px; color: #888;">
            This is an automated message from SMALDA. Please do not reply.
          </p>
        </body>
      </html>
    `;

    await this.sendMail(to, subject, html, NotificationType.VERIFICATION_COMPLETE, documentId);
  }

  async sendVerificationFailed(
    to: string,
    documentId: string,
    reason: string,
  ): Promise<void> {
    const subject = 'Document Verification Failed';
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #c62828;">Document Verification Failed</h2>
          <p>Unfortunately, we were unable to complete the verification for your document.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold; width: 40%;">Document ID</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${documentId}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">Reason</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${reason}</td>
            </tr>
          </table>
          <p style="margin-top: 16px;">
            Please review your document and try again. If the issue persists, contact support.
          </p>
          <p style="margin-top: 24px; font-size: 12px; color: #888;">
            This is an automated message from SMALDA. Please do not reply.
          </p>
        </body>
      </html>
    `;

    await this.sendMail(to, subject, html, NotificationType.VERIFICATION_FAILED, documentId);
  }

  async sendHighRiskAlert(
    to: string,
    documentId: string,
    score: number,
  ): Promise<void> {
    const subject = 'High Risk Document Alert';
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #e65100;">High Risk Document Detected</h2>
          <p>A document associated with your account has been flagged as <strong>high risk</strong> and requires immediate attention.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold; width: 40%;">Document ID</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${documentId}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">Risk Score</td>
              <td style="padding: 8px; border: 1px solid #ddd; color: #c62828; font-weight: bold;">${score.toFixed(2)}</td>
            </tr>
          </table>
          <p style="margin-top: 16px;">
            Please log in to your SMALDA dashboard to review the flagged indicators and take appropriate action.
          </p>
          <p style="margin-top: 24px; font-size: 12px; color: #888;">
            This is an automated message from SMALDA. Please do not reply.
          </p>
        </body>
      </html>
    `;

    await this.sendMail(to, subject, html, NotificationType.HIGH_RISK_ALERT, documentId);
  }

  private async sendMail(
    to: string,
    subject: string,
    html: string,
    type: NotificationType,
    documentId: string,
  ): Promise<void> {
    const from = this.configService.get<string>('SMTP_FROM');
    const log = this.notificationLogRepository.create({
      recipient: to,
      subject,
      type,
      documentId,
      success: false,
      errorMessage: null,
    });

    try {
      await this.transporter.sendMail({ from, to, subject, html });
      log.success = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.errorMessage = message;
      this.logger.error(
        `Failed to send "${type}" email to ${to} for document ${documentId}: ${message}`,
      );
    } finally {
      await this.notificationLogRepository.save(log);
    }
  }
}
