import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the per-user notification preferences column (#1605). */
export class AddUserNotificationPreferences1763600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notification_preferences" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "notification_preferences"',
    );
  }
}
