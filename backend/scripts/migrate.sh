#!/bin/bash

# Migration script for CI/CD pipeline
# This script runs database migrations before starting the server

set -e

echo "🔄 Running database migrations..."

# Check if database is ready
until pg_isready -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER"; do
  echo "⏳ Waiting for database to be ready..."
  sleep 2
done

echo "✅ Database is ready"

# Run migrations
npm run migration:run

echo "🎉 Migrations completed successfully"
