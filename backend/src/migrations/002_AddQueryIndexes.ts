import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQueryIndexes1700000000001 implements MigrationInterface {
  name = 'AddQueryIndexes1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add indexes for Document entity
    await queryRunner.query(`
      CREATE INDEX "IDX_DOCUMENT_OWNER_ID" ON "documents" ("owner_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_DOCUMENT_STATUS" ON "documents" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_DOCUMENT_CREATED_AT" ON "documents" ("created_at")
    `);

    // Add index for VerificationRecord entity
    await queryRunner.query(`
      CREATE INDEX "IDX_VERIFICATION_RECORD_STATUS" ON "verification_records" ("status")
    `);

    // Add index for User entity
    await queryRunner.query(`
      CREATE INDEX "IDX_USER_IS_VERIFIED" ON "users" ("is_verified")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes in reverse order
    await queryRunner.query(`DROP INDEX "IDX_USER_IS_VERIFIED"`);
    await queryRunner.query(`DROP INDEX "IDX_VERIFICATION_RECORD_STATUS"`);
    await queryRunner.query(`DROP INDEX "IDX_DOCUMENT_CREATED_AT"`);
    await queryRunner.query(`DROP INDEX "IDX_DOCUMENT_STATUS"`);
    await queryRunner.query(`DROP INDEX "IDX_DOCUMENT_OWNER_ID"`);
  }
}
