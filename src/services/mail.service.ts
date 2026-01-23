import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    this.init();
  }

  private init() {
    const host = process.env.MAIL_HOST;
    const port = Number(process.env.MAIL_PORT) || 465;
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user,
          pass,
        },
      });
      this.logger.log(`Mail service initialized with host: ${host}`);
    } else {
      this.logger.warn(
        'Mail service not initialized. Missing MAIL_HOST, MAIL_USER, or MAIL_PASS.'
      );
    }
  }

  async sendMail(subject: string, text: string) {
    if (!this.transporter) {
      this.logger.warn('Cannot send mail: Transporter not initialized');
      return;
    }

    const from = process.env.MAIL_FROM || process.env.MAIL_USER;
    const to = process.env.MAIL_TO;

    if (!to) {
      this.logger.warn('Cannot send mail: MAIL_TO not configured');
      return;
    }

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject,
        text,
      });
      this.logger.log(`Mail sent to ${to}: ${subject}`);
    } catch (e: any) {
      this.logger.error(`Failed to send mail: ${e.message}`);
    }
  }
}
