# MailMind Database Migration Scripts

This directory contains comprehensive database migration tools for MailMind.

## 📋 Quick Start

### Check Migration Status
```bash
npm run db:migrate:status
```

### Run All Pending Migrations
```bash
npm run db:migrate:all
```

### Create Database Backup
```bash
npm run db:migrate:backup
```

## 🛠️ Available Scripts

### Bash Version (Linux/macOS)
```bash
# Direct execution
./scripts/run-all-migrations.sh [options]

# Available options
./scripts/run-all-migrations.sh --help
./scripts/run-all-migrations.sh --status
./scripts/run-all-migrations.sh --dry-run
./scripts/run-all-migrations.sh --backup
./scripts/run-all-migrations.sh --rollback
./scripts/run-all-migrations.sh --force
```

### Node.js Version (Cross-platform)
```bash
# Using npm scripts (recommended)
npm run db:migrate:all
npm run db:migrate:status
npm run db:migrate:backup

# Direct execution
node scripts/run-all-migrations.js [options]

# Available options
node scripts/run-all-migrations.js --help
node scripts/run-all-migrations.js --status
node scripts/run-all-migrations.js --dry-run
node scripts/run-all-migrations.js --backup
node scripts/run-all-migrations.js --rollback
node scripts/run-all-migrations.js --force
```

## 🎯 Migration Order

The scripts apply migrations in this exact order:

1. `0001_initial_schema.sql` - Initial database structure
2. `0002_schema_updates.sql` - Core table updates
3. `0003_model_default_update.sql` - Model configuration
4. `0004_performance_indexes.sql` - Database indexing
5. `0005_data_integrity_constraints.sql` - Data validation
6. `0006_add_templates_table.sql` - Template system
7. `0006_security_improvements.sql` - Security enhancements
8. `0007_hotfix_conversations_columns.sql` - Conversation fixes
9. `0008_model_default_gpt5_chat.sql` - AI model updates
10. `0009_add_handover_prompt_spec.sql` - Handover specifications
11. `0010_security_and_api_keys.sql` - API key management
12. `0011_email_reliability_system.sql` - Email delivery system
13. `0012_stop_on_complaint.sql` - Complaint handling
14. `0013_intent_handover.sql` - Intent-based handover system
15. `0014_add_provider_message_id.sql` - Message deduplication
16. `0015_campaign_send_window.sql` - Send window enforcement
17. `0016_campaign_send_window.sql` - Send window enhancements
18. `0017_auto_stop_followups.sql` - Auto-stop follow-ups

## ✨ Key Features

### 🔒 Safety First
- **Automatic Backups**: Creates backup before applying migrations
- **Migration Tracking**: Records applied migrations to prevent duplicates
- **Rollback Support**: Can restore from backup if needed
- **Error Handling**: Graceful failure with detailed logging

### 🎛️ Flexible Execution
- **Dry Run Mode**: Preview changes without applying them
- **Force Mode**: Skip confirmation prompts for CI/CD
- **Status Check**: See which migrations are applied/pending
- **Selective Application**: Automatically skips already-applied migrations

### 📊 Comprehensive Logging
- **Detailed Logs**: All operations logged with timestamps
- **Error Context**: Clear error messages with troubleshooting hints
- **Progress Tracking**: Real-time status updates during execution

### 🔄 Production Ready
- **CI/CD Compatible**: Works in automated environments
- **Cross-platform**: Both bash and Node.js versions available
- **Database Agnostic**: Uses standard PostgreSQL commands

## 📖 Usage Examples

### Development Environment
```bash
# Check what needs to be migrated
npm run db:migrate:status

# Preview changes
node scripts/run-all-migrations.js --dry-run

# Apply all migrations
npm run db:migrate:all
```

### Production Environment
```bash
# Set DATABASE_URL
export DATABASE_URL="postgresql://user:pass@host:port/dbname"

# Create backup first
npm run db:migrate:backup

# Apply migrations with confirmation
npm run db:migrate:all

# Or skip confirmations for automated deployment
node scripts/run-all-migrations.js --force
```

### CI/CD Pipeline
```bash
# In your deployment script
export DATABASE_URL=$PRODUCTION_DATABASE_URL
node scripts/run-all-migrations.js --force --backup
```

### Troubleshooting
```bash
# Check current status
npm run db:migrate:status

# Create manual backup
npm run db:migrate:backup

# Rollback if needed (requires backup file)
node scripts/run-all-migrations.js --rollback
```

## 🚨 Environment Requirements

### Required Environment Variables
```bash
DATABASE_URL="postgresql://username:password@host:port/database"
```

### Required System Dependencies
- PostgreSQL client tools (`psql`, `pg_dump`)
- Node.js 16+ (for Node.js version)
- Bash shell (for bash version)

### Database Permissions
The database user needs these permissions:
- `CREATE TABLE`
- `ALTER TABLE`
- `CREATE INDEX`
- `INSERT/UPDATE/DELETE` on all tables
- `SELECT` on information_schema tables

## 📁 File Structure

```
scripts/
├── run-all-migrations.sh      # Bash version (Linux/macOS)
├── run-all-migrations.js      # Node.js version (cross-platform)
└── MIGRATION_README.md        # This documentation

drizzle/
├── 0001_initial_schema.sql
├── 0002_schema_updates.sql
├── ...
└── 0017_auto_stop_followups.sql
```

## 🐛 Troubleshooting

### Common Issues

#### "psql: command not found"
```bash
# Install PostgreSQL client
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql

# Windows
# Download from https://www.postgresql.org/download/windows/
```

#### "Permission denied connecting to database"
```bash
# Check your DATABASE_URL format
export DATABASE_URL="postgresql://username:password@host:port/database"

# Test connection manually
psql "$DATABASE_URL" -c "SELECT 1;"
```

#### "Migration tracking table doesn't exist"
The script automatically creates the `drizzle_migrations` table. If you see this error:
```bash
# Run the script again - it will create the table
npm run db:migrate:all
```

#### "Migration already applied but showing as pending"
```bash
# Check tracking table
psql "$DATABASE_URL" -c "SELECT * FROM drizzle_migrations ORDER BY created_at;"

# If migration is missing from tracking, you can manually add it
psql "$DATABASE_URL" -c "INSERT INTO drizzle_migrations (hash) VALUES ('migration_name.sql');"
```

### Log Files

Migration logs are saved to `/tmp/mailmind_migration_TIMESTAMP.log`:
```bash
# View recent log
ls -la /tmp/mailmind_migration_*.log | tail -1

# Follow log in real-time (if running script in background)
tail -f /tmp/mailmind_migration_$(date +%Y%m%d)*.log
```

### Backup Files

Backups are saved to `/tmp/mailmind_backup_TIMESTAMP.sql`:
```bash
# List available backups
ls -la /tmp/mailmind_backup_*.sql

# Restore from backup manually
psql "$DATABASE_URL" < /tmp/mailmind_backup_20240101_120000.sql
```

## 🚀 Best Practices

### Development
1. Always run `--dry-run` first to preview changes
2. Create manual backups before major migrations
3. Test migrations on development data first

### Production
1. **Always** create a backup before migrations
2. Run migrations during low-traffic periods
3. Test the rollback process in staging first
4. Monitor application logs after migration
5. Have a rollback plan ready

### CI/CD
1. Use `--force` flag to skip confirmations
2. Include `--backup` to create automatic backups
3. Store backup files in persistent storage
4. Add database connection checks before migration
5. Set appropriate timeout values for long migrations

## 📞 Support

If you encounter issues:

1. Check the log file for detailed error messages
2. Verify database connectivity with `psql "$DATABASE_URL" -c "SELECT 1;"`
3. Ensure all required environment variables are set
4. Review the migration files for syntax errors
5. Check database permissions for the connecting user

For additional help, review the migration files in the `drizzle/` directory to understand what each migration does.

---

**⚠️ Important**: Always test migrations in a development environment before applying to production!