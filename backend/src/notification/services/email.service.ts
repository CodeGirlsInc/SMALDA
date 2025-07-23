import { Injectable, Logger } from "@nestjs/common"
import * as nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"
import type { EmailOptions } from "../interfaces/notification-template.interface"

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private transporter: Transporter

  constructor() {
    this.initializeTransporter()
  }

  private initializeTransporter() {
    // Configure based on environment
    if (process.env.NODE_ENV === "production") {
      // Production SMTP configuration
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: Number.parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    } else {
      // Development - use Ethereal Email for testing
      this.transporter = nodemailer.createTransporter({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: "ethereal.user@ethereal.email",
          pass: "ethereal.pass",
        },
      })
    }
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const mailOptions = {
        from: options.from || process.env.SMTP_FROM || "noreply@landregistry.com",
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      }

      const result = await this.transporter.sendMail(mailOptions)

      this.logger.log(`Email sent successfully to ${options.to}. MessageId: ${result.messageId}`)

      return {
        success: true,
        messageId: result.messageId,
      }
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}:`, error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify()
      this.logger.log("SMTP connection verified successfully")
      return true
    } catch (error) {
      this.logger.error("SMTP connection verification failed:", error)
      return false
    }
  }
}
