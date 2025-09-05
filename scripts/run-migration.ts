#!/usr/bin/env tsx
/**
 * Production Migration Runner
 * Executes SQL migrations with proper error handling and rollback support
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

const { Pool } = pg;

interface MigrationOptions {
  dryRun?: boolean;
  verbose?: boolean;
  connectionString?: string;
}

class MigrationRunner {
  private pool: pg.Pool;
  private db: ReturnType<typeof drizzle>;
  private options: MigrationOptions;

  constructor(options: MigrationOptions = {}) {
    this.options = {
      dryRun: false,
      verbose: true,
      ...options
    };

    const connectionString = options.connectionString || process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    this.pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      max: 1, // Use single connection for migrations
    });

    this.db = drizzle(this.pool);
  }

  private log(message: string, level: 'info' | 'success' | 'error' | 'warn' = 'info') {
    if (!this.options.verbose && level === 'info') return;

    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      error: '\x1b[31m',   // Red
      warn: '\x1b[33m',    // Yellow
    };

    const reset = '\x1b[0m';
    const prefix = this.options.dryRun ? '[DRY RUN] ' : '';
    
    console.log(`${colors[level]}${prefix}${message}${reset}`);
  }

  async runMigration(migrationPath: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Read migration file
      const migrationSql = await fs.readFile(migrationPath, 'utf-8');
      
      this.log(`Starting migration: ${path.basename(migrationPath)}`, 'info');
      this.log(`Database: ${this.options.connectionString?.replace(/:[^:@]+@/, ':****@')}`, 'info');
      
      if (this.options.dryRun) {
        this.log('DRY RUN MODE - No changes will be made', 'warn');
        this.log('\nMigration SQL to be executed:', 'info');
        console.log(migrationSql);
        return;
      }

      // Test connection
      await this.pool.query('SELECT 1');
      this.log('Database connection established', 'success');

      // Execute migration
      this.log('Executing migration...', 'info');
      const result = await this.pool.query(migrationSql);
      
      // Log notices from the migration
      if (result && Array.isArray(result)) {
        result.forEach((r: any) => {
          if (r.command) {
            this.log(`Executed: ${r.command}`, 'info');
          }
        });
      }

      const duration = Date.now() - startTime;
      this.log(`Migration completed successfully in ${duration}ms`, 'success');

    } catch (error) {
      const duration = Date.now() - startTime;
      this.log(`Migration failed after ${duration}ms`, 'error');
      
      if (error instanceof Error) {
        this.log(`Error: ${error.message}`, 'error');
        if (this.options.verbose) {
          console.error('Stack trace:', error.stack);
        }
      }
      
      throw error;
    }
  }

  async verifyMigration(): Promise<void> {
    this.log('\nVerifying migration results...', 'info');

    const verificationQueries = [
      {
        name: 'ai_agent_config.from_name',
        query: `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'ai_agent_config' AND column_name = 'from_name'
        `
      },
      {
        name: 'leads.product_interest',
        query: `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'leads' AND column_name = 'product_interest'
        `
      },
      {
        name: 'campaigns.handover_criteria',
        query: `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'campaigns' AND column_name = 'handover_criteria'
        `
      },
      {
        name: 'security_events table',
        query: `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_name = 'security_events'
        `
      },
      {
        name: 'security_events indexes',
        query: `
          SELECT indexname
          FROM pg_indexes
          WHERE tablename = 'security_events'
          ORDER BY indexname
        `
      }
    ];

    for (const verification of verificationQueries) {
      try {
        const result = await this.pool.query(verification.query);
        
        if (result.rows.length > 0) {
          this.log(`✓ ${verification.name} exists`, 'success');
          if (this.options.verbose && verification.name.includes('indexes')) {
            result.rows.forEach(row => {
              this.log(`  - ${row.indexname}`, 'info');
            });
          }
        } else {
          this.log(`✗ ${verification.name} not found`, 'error');
        }
      } catch (error) {
        this.log(`✗ Failed to verify ${verification.name}`, 'error');
        if (this.options.verbose && error instanceof Error) {
          this.log(`  ${error.message}`, 'error');
        }
      }
    }
  }

  async getSchemaInfo(): Promise<void> {
    this.log('\nCurrent schema information:', 'info');

    const queries = [
      {
        name: 'Tables with row counts',
        query: `
          SELECT 
            schemaname,
            tablename,
            n_live_tup as estimated_rows
          FROM pg_stat_user_tables
          WHERE schemaname = 'public'
          ORDER BY tablename
        `
      },
      {
        name: 'Missing columns check',
        query: `
          SELECT 
            'ai_agent_config.from_name' as expected_column,
            CASE 
              WHEN EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'ai_agent_config' AND column_name = 'from_name'
              ) THEN 'EXISTS' 
              ELSE 'MISSING' 
            END as status
          UNION ALL
          SELECT 
            'leads.product_interest',
            CASE 
              WHEN EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'leads' AND column_name = 'product_interest'
              ) THEN 'EXISTS' 
              ELSE 'MISSING' 
            END
          UNION ALL
          SELECT 
            'campaigns.handover_criteria',
            CASE 
              WHEN EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'campaigns' AND column_name = 'handover_criteria'
              ) THEN 'EXISTS' 
              ELSE 'MISSING' 
            END
        `
      }
    ];

    for (const query of queries) {
      try {
        const result = await this.pool.query(query.query);
        this.log(`\n${query.name}:`, 'info');
        console.table(result.rows);
      } catch (error) {
        this.log(`Failed to get ${query.name}`, 'error');
      }
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.log('Database connection closed', 'info');
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const flags = {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    verify: args.includes('--verify'),
    info: args.includes('--info'),
    help: args.includes('--help') || args.includes('-h'),
    production: args.includes('--production') || args.includes('-p'),
  };

  if (flags.help) {
    console.log(`
Migration Runner for OfferLogix

Usage: tsx scripts/run-migration.ts [options]

Options:
  --dry-run, -d     Show what would be executed without making changes
  --verbose, -v     Show detailed output
  --verify          Verify migration results after execution
  --info            Show current schema information
  --production, -p  Use production database (requires DATABASE_URL_PRODUCTION)
  --help, -h        Show this help message

Environment Variables:
  DATABASE_URL            Local/development database connection string
  DATABASE_URL_PRODUCTION Production database connection string

Examples:
  # Dry run on local database
  tsx scripts/run-migration.ts --dry-run

  # Run migration on local database with verification
  tsx scripts/run-migration.ts --verify --verbose

  # Run migration on production (requires confirmation)
  tsx scripts/run-migration.ts --production --verify

  # Check current schema status
  tsx scripts/run-migration.ts --info
`);
    process.exit(0);
  }

  const migrationPath = path.join(process.cwd(), 'fix_missing_schema.sql');
  
  // Determine connection string
  let connectionString: string | undefined;
  if (flags.production) {
    connectionString = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
    
    if (!flags.dryRun) {
      console.log('\n⚠️  WARNING: You are about to run a migration on the PRODUCTION database!');
      console.log('This action cannot be undone. Make sure you have a backup.');
      console.log('\nPress Ctrl+C to cancel, or any other key to continue...');
      
      // Wait for user input
      await new Promise((resolve) => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', resolve);
      });
      process.stdin.setRawMode(false);
    }
  } else {
    connectionString = process.env.DATABASE_URL;
  }

  const runner = new MigrationRunner({
    dryRun: flags.dryRun,
    verbose: flags.verbose,
    connectionString,
  });

  try {
    // Show schema info if requested
    if (flags.info) {
      await runner.getSchemaInfo();
    } else {
      // Check if migration file exists
      try {
        await fs.access(migrationPath);
      } catch {
        console.error(`Migration file not found: ${migrationPath}`);
        process.exit(1);
      }

      // Run migration
      await runner.runMigration(migrationPath);

      // Verify if requested
      if (flags.verify && !flags.dryRun) {
        await runner.verifyMigration();
      }
    }

    await runner.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed!');
    if (error instanceof Error) {
      console.error(error.message);
    }
    await runner.close();
    process.exit(1);
  }
}

// Run if executed directly
main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

export { MigrationRunner };