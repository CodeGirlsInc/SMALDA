# Migration Workflow Notes

This document outlines the expected TypeORM migration process for issue #229. The goal is to replace `synchronize: true` with an explicit, predictable migration workflow that can be run via the TypeORM CLI.

## 1. Generate a migration

1. Ensure your entity definitions are stable.
2. Run `npm run migration:generate -- -n DescribeChange` to produce a timestamped migration file under `src/migrations`.
3. Review the generated SQL carefully before committing.

## 2. Run migrations

Use `npm run migration:run` to apply every pending migration to the target database. This is the command to execute after a fresh `npm install` or when deploying to a new environment.

## 3. Revert the last migration

If you need to back out the most recent change, run `npm run migration:revert`. This command rolls back the latest migration that was applied.

## 4. Best practices

- Commit each migration file alongside the code changes that require it.
- Never set `synchronize: true` in production—always use migrations so schema changes are tracked.
- Tag the database version (optional) to align with releases if you have multiple deploy targets.
- Keep any SQL manual adjustments documented in this file when automatic generation falls short.
