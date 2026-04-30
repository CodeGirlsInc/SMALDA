import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationPrefsService {
  async shouldSendVerificationComplete(_userId: string): Promise<boolean> {
    return true;
  }

  async shouldSendRiskAlert(_userId: string): Promise<boolean> {
    return true;
  }
}
