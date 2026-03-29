import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "password_hash" character varying,
        "full_name" character varying NOT NULL,
        "role" character varying NOT NULL DEFAULT 'user',
        "is_verified" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    // Create documents table
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "owner_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "file_path" character varying NOT NULL,
        "file_hash" character varying NOT NULL,
        "file_size" integer NOT NULL,
        "mime_type" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "risk_score" real,
        "risk_flags" json,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "IDX_DOCUMENT_FILE_HASH" UNIQUE ("file_hash"),
        CONSTRAINT "PK_documents_id" PRIMARY KEY ("id")
      )
    `);

    // Create verification_records table
    await queryRunner.query(`
      CREATE TABLE "verification_records" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "document_id" uuid NOT NULL,
        "stellar_tx_hash" character varying NOT NULL,
        "stellar_ledger" integer NOT NULL,
        "anchored_at" TIMESTAMPTZ,
        "status" character varying NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_verification_records_id" PRIMARY KEY ("id")
      )
    `);

    // Create transfers table
    await queryRunner.query(`
      CREATE TABLE "transfers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "document_id" uuid NOT NULL,
        "from_user_id" uuid NOT NULL,
        "to_user_id" uuid NOT NULL,
        "stellar_tx_hash" character varying,
        "transferred_at" TIMESTAMPTZ NOT NULL,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transfers_id" PRIMARY KEY ("id")
      )
    `);

    // Create foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "documents" 
      ADD CONSTRAINT "FK_documents_owner_id" 
      FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "verification_records" 
      ADD CONSTRAINT "FK_verification_records_document_id" 
      FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "transfers" 
      ADD CONSTRAINT "FK_transfers_document_id" 
      FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "transfers" 
      ADD CONSTRAINT "FK_transfers_from_user_id" 
      FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "transfers" 
      ADD CONSTRAINT "FK_transfers_to_user_id" 
      FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_VERIFICATION_RECORD_DOCUMENT" 
      ON "verification_records" ("document_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_VERIFICATION_RECORD_DOCUMENT"`);
    await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT "FK_transfers_to_user_id"`);
    await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT "FK_transfers_from_user_id"`);
    await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT "FK_transfers_document_id"`);
    await queryRunner.query(`ALTER TABLE "verification_records" DROP CONSTRAINT "FK_verification_records_document_id"`);
    await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT "FK_documents_owner_id"`);
    await queryRunner.query(`DROP TABLE "transfers"`);
    await queryRunner.query(`DROP TABLE "verification_records"`);
    await queryRunner.query(`DROP TABLE "documents"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
