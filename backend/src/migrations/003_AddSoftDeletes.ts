import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeletes1700000000002 implements MigrationInterface {
  name = 'AddSoftDeletes1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add deletedAt column to documents table
    await queryRunner.query(`
      ALTER TABLE "documents" 
      ADD "deleted_at" TIMESTAMP
    `);

    // Add deletedAt column to verification_records table
    await queryRunner.query(`
      ALTER TABLE "verification_records" 
      ADD "deleted_at" TIMESTAMP
    `);

    // Create indexes for deletedAt columns to optimize soft delete queries
    await queryRunner.query(`
      CREATE INDEX "IDX_DOCUMENT_DELETED_AT" ON "documents" ("deleted_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_VERIFICATION_RECORD_DELETED_AT" ON "verification_records" ("deleted_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.query(`DROP INDEX "IDX_VERIFICATION_RECORD_DELETED_AT"`);
    await queryRunner.query(`DROP INDEX "IDX_DOCUMENT_DELETED_AT"`);

    // Drop columns
    await queryRunner.query(`ALTER TABLE "verification_records" DROP COLUMN "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "deleted_at"`);
  }
}
