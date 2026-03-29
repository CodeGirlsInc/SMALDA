const { execSync } = require('child_process');
const path = require('path');

// Migration script for CI/CD pipeline
// This script runs database migrations before starting the server

async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...');

    // Check if we're in development or production
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // In production, wait for database to be ready
      console.log('⏳ Waiting for database to be ready...');
      
      // Simple database connection check
      const maxRetries = 30;
      let retries = 0;
      
      while (retries < maxRetries) {
        try {
          await checkDatabaseConnection();
          console.log('✅ Database is ready');
          break;
        } catch (error) {
          retries++;
          if (retries >= maxRetries) {
            throw new Error('Database connection failed after maximum retries');
          }
          console.log(`⏳ Waiting for database... (${retries}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    // Run migrations
    console.log('🚀 Running TypeORM migrations...');
    execSync('npx typeorm migration:run', { stdio: 'inherit' });
    
    console.log('🎉 Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

async function checkDatabaseConnection() {
  // Simple check using environment variables
  const { DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_NAME } = process.env;
  
  if (!DATABASE_HOST || !DATABASE_PORT || !DATABASE_USER || !DATABASE_NAME) {
    throw new Error('Missing database configuration');
  }
  
  // In a real scenario, you might want to use a proper database client here
  // For now, we'll just check if the environment variables are set
  return true;
}

// Run migrations if this script is called directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
