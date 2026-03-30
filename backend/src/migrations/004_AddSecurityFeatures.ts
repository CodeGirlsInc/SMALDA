import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class AddSecurityFeatures1743350400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 2FA columns to users table
    await queryRunner.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS is_two_factor_enabled BOOLEAN DEFAULT FALSE
    `);

    // Create refresh_tokens table
    await queryRunner.createTable(
      new Table({
        name: 'refresh_tokens',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'token_hash',
            type: 'varchar',
            length: '64',
          },
          {
            name: 'expires_at',
            type: 'timestamp with time zone',
          },
          {
            name: 'revoked_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create index on user_id
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_REFRESH_TOKEN_USER" ON refresh_tokens (user_id)`);

    // Create index on token_hash
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_REFRESH_TOKEN_HASH" ON refresh_tokens (token_hash)`);

    // Add foreign key constraint
    await queryRunner.createForeignKey(
      'refresh_tokens',
      new TableForeignKey({
        name: 'FK_REFRESH_TOKEN_USER',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.dropForeignKey('refresh_tokens', 'FK_REFRESH_TOKEN_USER');

    // Drop refresh_tokens table
    await queryRunner.dropTable('refresh_tokens');

    // Remove 2FA columns from users table
    await queryRunner.query(`
      ALTER TABLE users 
      DROP COLUMN IF EXISTS two_factor_secret,
      DROP COLUMN IF EXISTS is_two_factor_enabled
    `);
  }
}
