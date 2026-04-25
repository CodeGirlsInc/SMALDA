import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPrefs } from './notification-prefs.entity';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';

@Injectable()
export class NotificationPrefsService {
  constructor(
    @InjectRepository(NotificationPrefs)
    private readonly notificationPrefsRepository: Repository<NotificationPrefs>,
  ) {}

  async getPreferences(userId: string): Promise<NotificationPrefs> {
    let preferences = await this.notificationPrefsRepository.findOne({
      where: { userId },
    });

    if (!preferences) {
      preferences = await this.createDefaultPreferences(userId);
    }

    return preferences;
  }

  async updatePreferences(
    userId: string,
    updateDto: UpdateNotificationPrefsDto,
  ): Promise<NotificationPrefs> {
    const preferences = await this.getPreferences(userId);

    Object.assign(preferences, updateDto);

    return this.notificationPrefsRepository.save(preferences);
  }

  private async createDefaultPreferences(userId: string): Promise<NotificationPrefs> {
    const defaultPrefs = this.notificationPrefsRepository.create({
      userId,
      riskAlert: true,
      verificationComplete: true,
      weeklyDigest: true,
    });

    return this.notificationPrefsRepository.save(defaultPrefs);
  }

  async shouldSendRiskAlert(userId: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId);
    return prefs.riskAlert;
  }

  async shouldSendVerificationComplete(userId: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId);
    return prefs.verificationComplete;
  }

  async shouldSendWeeklyDigest(userId: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId);
    return prefs.weeklyDigest;
  }
}
