@echo off
REM Migration script for Windows CI/CD pipeline
REM This script runs database migrations before starting the server

echo 🔄 Running database migrations...

REM Run migrations
call npm run migration:run

if %ERRORLEVEL% EQU 0 (
  echo 🎉 Migrations completed successfully
) else (
  echo ❌ Migration failed
  exit /b 1
)
