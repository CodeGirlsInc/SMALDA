import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiKeyService } from './api-key.service';

@Injectable()
export class ApiKeyCleanupService {
  private readonly logger = new Logger(ApiKeyCleanupService.name);

  constructor(private readonly apiKeyService: ApiKeyService) {}

  /**
   * Run cleanup every day at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleExpiredKeysCleanup() {
    try {
      this.logger.log('Starting API key cleanup job...');

      const cleanedCount = await this.apiKeyService.cleanupExpiredKeys();

      this.logger.log(
        `API key cleanup completed. ${cleanedCount} keys marked as expired.`,
      );
    } catch (error) {
      this.logger.error('Failed to cleanup expired API keys', error.stack);
    }
  }

  /**
   * Manual cleanup method for testing or manual triggers
   */
  async manualCleanup(): Promise<number> {
    try {
      this.logger.log('Manual API key cleanup triggered...');

      const cleanedCount = await this.apiKeyService.cleanupExpiredKeys();

      this.logger.log(
        `Manual cleanup completed. ${cleanedCount} keys marked as expired.`,
      );

      return cleanedCount;
    } catch (error) {
      this.logger.error('Failed to perform manual cleanup', error.stack);
      throw error;
    }
  }
}
