#!/usr/bin/env node

/**
 * MailMind Database Migration Script (Node.js version)
 * Runs all migrations in correct order with error handling and rollback support
 */

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Configuration
const PROJECT_ROOT = path.dirname(__dirname);
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, 'drizzle');
const BACKUP_FILE = `/tmp/mailmind_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
const LOG_FILE = `/tmp/mailmind_migration_${new Date().toISOString().replace(/[:.]/g, '-')}.log`;

// Migration files in correct order
const MIGRATIONS = [
  '0001_initial_schema.sql',
  '0002_schema_updates.sql',
  '0003_model_default_update.sql',
  '0004_performance_indexes.sql',
  '0005_data_integrity_constraints.sql',
  '0006_add_templates_table.sql',
  '0006_security_improvements.sql',
  '0007_hotfix_conversations_columns.sql',
  '0008_model_default_gpt5_chat.sql',
  '0009_add_handover_prompt_spec.sql',
  '0010_security_and_api_keys.sql',
  '0011_email_reliability_system.sql',
  '0012_stop_on_complaint.sql',
  '0013_intent_handover.sql',
  '0014_add_provider_message_id.sql',
  '0015_campaign_send_window.sql',
  '0016_campaign_send_window.sql',
  '0017_auto_stop_followups.sql',
];

// Utility functions
function printStatus(message) {
  console.log(`${colors.blue}[INFO]${colors.reset} ${message}`);
}

function printSuccess(message) {
  console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`);
}

function printWarning(message) {
  console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`);
}

function printError(message) {
  console.log(`${colors.red}[ERROR]${colors.reset} ${message}`);
}

function logToFile(message) {
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
}

// Check database connectivity
function checkDatabase() {
  printStatus('Checking database connectivity...');
  
  if (!process.env.DATABASE_URL) {
    printError('DATABASE_URL environment variable is not set');
    console.log('Please set DATABASE_URL before running migrations:');
    console.log('export DATABASE_URL="postgresql://user:pass@host:port/dbname"');
    process.exit(1);
  }
  
  try {
    execSync(`psql "${process.env.DATABASE_URL}" -c "SELECT 1;" > /dev/null 2>&1`);
    printSuccess('Database connection verified');
  } catch (error) {
    printError(`Cannot connect to database with DATABASE_URL: ${process.env.DATABASE_URL}`);
    process.exit(1);
  }
}

// Create database backup
function createBackup() {
  printStatus('Creating database backup...');
  
  try {
    execSync(`pg_dump "${process.env.DATABASE_URL}" > "${BACKUP_FILE}"`);
    printSuccess(`Backup created: ${BACKUP_FILE}`);
  } catch (error) {
    printWarning('Failed to create backup, but continuing with migrations');
    printWarning('Consider creating a manual backup before proceeding');
  }
}

// Check if migration was already applied
function isMigrationApplied(migrationName) {
  try {
    // Check if migrations tracking table exists
    const tableExists = execSync(
      `psql "${process.env.DATABASE_URL}" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'drizzle_migrations');"`,
      { encoding: 'utf8' }
    ).trim();
    
    if (tableExists === 't') {
      // Check if specific migration was applied
      const applied = execSync(
        `psql "${process.env.DATABASE_URL}" -t -c "SELECT EXISTS (SELECT 1 FROM drizzle_migrations WHERE hash = '${migrationName}');"`,
        { encoding: 'utf8' }
      ).trim();
      return applied === 't';
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

// Create migrations tracking table
function createTrackingTable() {
  printStatus('Creating migrations tracking table...');
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    );
  `;
  
  try {
    execSync(`psql "${process.env.DATABASE_URL}" -c "${createTableSQL}"`);
    printSuccess('Migrations tracking table ready');
  } catch (error) {
    printError('Failed to create migrations tracking table');
    logToFile(`Error creating tracking table: ${error.message}`);
    process.exit(1);
  }
}

// Apply a single migration
function applyMigration(migrationFile) {
  const migrationPath = path.join(MIGRATIONS_DIR, migrationFile);
  
  if (!fs.existsSync(migrationPath)) {
    printWarning(`Migration file not found: ${migrationPath} (skipping)`);
    return { success: true, skipped: true };
  }
  
  printStatus(`Applying migration: ${migrationFile}`);
  
  // Check if already applied
  if (isMigrationApplied(migrationFile)) {
    printSuccess(`Migration already applied: ${migrationFile} (skipping)`);
    return { success: true, skipped: true };
  }
  
  try {
    // Apply migration
    execSync(`psql "${process.env.DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${migrationPath}" >> "${LOG_FILE}" 2>&1`);
    
    // Record migration in tracking table
    try {
      execSync(`psql "${process.env.DATABASE_URL}" -c "INSERT INTO drizzle_migrations (hash, created_at) VALUES ('${migrationFile}', NOW()) ON CONFLICT (hash) DO NOTHING;"`);
    } catch (trackingError) {
      // Non-fatal error
      logToFile(`Warning: Failed to record migration in tracking table: ${trackingError.message}`);
    }
    
    printSuccess(`Applied migration: ${migrationFile}`);
    return { success: true, skipped: false };
  } catch (error) {
    printError(`Failed to apply migration: ${migrationFile}`);
    printError(`Check log file: ${LOG_FILE}`);
    logToFile(`Migration ${migrationFile} failed: ${error.message}`);
    return { success: false, skipped: false };
  }
}

// Show migration status
function showMigrationStatus() {
  printStatus('Migration Status Summary:');
  console.log('==========================');
  
  const totalMigrations = MIGRATIONS.length;
  let appliedCount = 0;
  let skippedCount = 0;
  
  MIGRATIONS.forEach(migration => {
    const migrationPath = path.join(MIGRATIONS_DIR, migration);
    
    if (!fs.existsSync(migrationPath)) {
      console.log(`${migration.padEnd(35)} ${colors.yellow}MISSING${colors.reset}`);
      skippedCount++;
    } else if (isMigrationApplied(migration)) {
      console.log(`${migration.padEnd(35)} ${colors.green}APPLIED${colors.reset}`);
      appliedCount++;
    } else {
      console.log(`${migration.padEnd(35)} ${colors.yellow}PENDING${colors.reset}`);
    }
  });
  
  console.log('==========================');
  console.log(`Total migrations: ${totalMigrations}`);
  console.log(`Applied: ${appliedCount}`);
  console.log(`Missing/Skipped: ${skippedCount}`);
  console.log(`Pending: ${totalMigrations - appliedCount - skippedCount}`);
}

// Rollback function
function rollback() {
  if (fs.existsSync(BACKUP_FILE)) {
    printStatus('Rolling back database from backup...');
    try {
      execSync(`psql "${process.env.DATABASE_URL}" < "${BACKUP_FILE}"`);
      printSuccess('Database rolled back successfully');
    } catch (error) {
      printError('Failed to rollback database');
      logToFile(`Rollback failed: ${error.message}`);
    }
  } else {
    printError('No backup file found for rollback');
  }
}

// Show help
function showHelp() {
  console.log('MailMind Database Migration Script (Node.js)');
  console.log('');
  console.log(`Usage: node ${path.basename(__filename)} [options]`);
  console.log('');
  console.log('Options:');
  console.log('  --dry-run     Show what would be done without executing');
  console.log('  --status      Show current migration status');
  console.log('  --backup      Create backup only');
  console.log('  --rollback    Rollback from backup');
  console.log('  --force       Skip confirmation prompts');
  console.log('  --help        Show this help message');
  console.log('');
  console.log('Environment Variables:');
  console.log('  DATABASE_URL  PostgreSQL connection string (required)');
  console.log('');
  console.log('Examples:');
  console.log(`  node ${path.basename(__filename)}                          # Run all pending migrations`);
  console.log(`  node ${path.basename(__filename)} --status                 # Show migration status`);
  console.log(`  node ${path.basename(__filename)} --dry-run                # Preview what will be done`);
  console.log('');
}

// Prompt user for confirmation
function promptConfirmation(question) {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question(`${question} (y/N): `, (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Main execution function
async function main() {
  const args = process.argv.slice(2);
  let dryRun = args.includes('--dry-run');
  let force = args.includes('--force');
  let statusOnly = args.includes('--status');
  let backupOnly = args.includes('--backup');
  let rollbackRequested = args.includes('--rollback');
  let helpRequested = args.includes('--help');
  
  if (helpRequested) {
    showHelp();
    process.exit(0);
  }
  
  // Print header
  console.log('======================================');
  console.log('   MailMind Database Migration Tool   ');
  console.log('         (Node.js Version)            ');
  console.log('======================================');
  console.log(`Log file: ${LOG_FILE}`);
  console.log('');
  
  // Initialize log file
  logToFile('Migration script started');
  
  // Check database connectivity
  checkDatabase();
  
  // Handle special modes
  if (rollbackRequested) {
    rollback();
    process.exit(0);
  }
  
  if (backupOnly) {
    createBackup();
    process.exit(0);
  }
  
  // Create migrations tracking table
  createTrackingTable();
  
  if (statusOnly) {
    showMigrationStatus();
    process.exit(0);
  }
  
  // Show current status
  showMigrationStatus();
  console.log('');
  
  // Dry run mode
  if (dryRun) {
    printStatus('DRY RUN MODE - No changes will be made');
    console.log('');
    MIGRATIONS.forEach(migration => {
      const migrationPath = path.join(MIGRATIONS_DIR, migration);
      if (!fs.existsSync(migrationPath)) {
        printWarning(`Would skip (missing): ${migration}`);
      } else if (isMigrationApplied(migration)) {
        printStatus(`Would skip (applied): ${migration}`);
      } else {
        printSuccess(`Would apply: ${migration}`);
      }
    });
    process.exit(0);
  }
  
  // Confirmation prompt
  if (!force) {
    console.log('');
    const confirmed = await promptConfirmation('Do you want to proceed with applying pending migrations?');
    if (!confirmed) {
      printStatus('Migration cancelled by user');
      process.exit(0);
    }
  }
  
  // Create backup before applying migrations
  createBackup();
  
  // Apply migrations
  printStatus('Starting migration process...');
  console.log('');
  
  const failedMigrations = [];
  const appliedMigrations = [];
  
  for (const migration of MIGRATIONS) {
    const result = applyMigration(migration);
    
    if (result.success && !result.skipped) {
      appliedMigrations.push(migration);
    } else if (!result.success) {
      failedMigrations.push(migration);
      printError(`Migration failed: ${migration}`);
      
      if (!force) {
        console.log('');
        console.log('Options:');
        console.log('1) Continue with remaining migrations');
        console.log('2) Rollback all changes');
        console.log('3) Stop here (leave applied migrations in place)');
        
        const choice = await promptConfirmation('Continue with remaining migrations? (1=yes, 2=rollback, 3=stop)');
        
        if (!choice) {
          console.log('');
          const rollbackChoice = await promptConfirmation('Do you want to rollback all changes?');
          if (rollbackChoice) {
            printStatus('Rolling back all changes...');
            rollback();
            process.exit(1);
          } else {
            printStatus('Stopping migration process');
            process.exit(1);
          }
        }
      } else {
        printError('Migration failed in --force mode, stopping');
        process.exit(1);
      }
    }
  }
  
  // Final status
  console.log('');
  console.log('======================================');
  printSuccess('Migration process completed!');
  console.log('======================================');
  
  if (appliedMigrations.length > 0) {
    printSuccess(`Successfully applied ${appliedMigrations.length} migrations:`);
    appliedMigrations.forEach(migration => {
      console.log(`  ✓ ${migration}`);
    });
  }
  
  if (failedMigrations.length > 0) {
    printWarning(`Failed migrations (${failedMigrations.length}):`);
    failedMigrations.forEach(migration => {
      console.log(`  ✗ ${migration}`);
    });
    console.log('');
    printWarning(`Some migrations failed. Check the log file: ${LOG_FILE}`);
    console.log(`Backup available at: ${BACKUP_FILE}`);
    process.exit(1);
  }
  
  console.log('');
  printSuccess('All migrations completed successfully!');
  console.log(`Log file: ${LOG_FILE}`);
  console.log(`Backup file: ${BACKUP_FILE}`);
  
  // Show final status
  console.log('');
  showMigrationStatus();
  
  logToFile('Migration script completed successfully');
}

// Handle interruption
process.on('SIGINT', () => {
  console.log('');
  printError('Migration interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('');
  printError('Migration terminated');
  process.exit(1);
});

// Run main function
main().catch(error => {
  printError(`Unexpected error: ${error.message}`);
  logToFile(`Unexpected error: ${error.message}`);
  process.exit(1);
});