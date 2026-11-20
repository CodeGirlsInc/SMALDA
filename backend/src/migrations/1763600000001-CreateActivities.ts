import { MigrationInterface, QueryRunner } from 'typeorm';

/** Creates the `activities` table backing GET /admin/activity (#1607). */
export class CreateActivities1763600000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "activities" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "userId" character varying NOT NULL,
      "actionType" character varying NOT NULL,
      "ipAddress" character varying,
      "metadata" jsonb,
      "timestamp" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PK_activities_id" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_activities_user" ON "activities" ("userId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_activities_timestamp" ON "activities" ("timestamp")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "activities"');
  }
}
