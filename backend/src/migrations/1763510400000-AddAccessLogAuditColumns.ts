import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds structured audit fields to access_logs and an index on the user id
 * column, supporting real action/resource/metadata logging and retention.
 */
export class AddAccessLogAuditColumns1763510400000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "access_logs" ADD COLUMN IF NOT EXISTS "action" character varying',
    );
    await queryRunner.query(
      'ALTER TABLE "access_logs" ADD COLUMN IF NOT EXISTS "resource_type" character varying',
    );
    await queryRunner.query(
      'ALTER TABLE "access_logs" ADD COLUMN IF NOT EXISTS "resource_id" character varying',
    );
    await queryRunner.query(
      'ALTER TABLE "access_logs" ADD COLUMN IF NOT EXISTS "metadata" jsonb',
    );
    await queryRunner.query(
      'ALTER TABLE "access_logs" ADD COLUMN IF NOT EXISTS "user_agent" character varying',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_access_logs_user_id" ON "access_logs" ("userId")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "idx_access_logs_user_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "access_logs" DROP COLUMN IF EXISTS "user_agent"',
    );
    await queryRunner.query(
      'ALTER TABLE "access_logs" DROP COLUMN IF EXISTS "metadata"',
    );
    await queryRunner.query(
      'ALTER TABLE "access_logs" DROP COLUMN IF EXISTS "resource_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "access_logs" DROP COLUMN IF EXISTS "resource_type"',
    );
    await queryRunner.query(
      'ALTER TABLE "access_logs" DROP COLUMN IF EXISTS "action"',
    );
  }
}
