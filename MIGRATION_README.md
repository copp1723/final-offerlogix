# OfferLogix Database Migration Guide

This guide documents the database migration process for fixing missing schema elements in the OfferLogix B2B sales platform.

## Overview

The migration (`fix_missing_schema.sql`) addresses production database issues by:
- Adding missing columns to existing tables
- Creating the security_events table
- Ensuring proper indexes for performance
- Setting up default values where appropriate

## Migration Details

### Columns Added
1. **ai_agent_config.from_name** (TEXT) - Dedicated email From: display name
2. **leads.product_interest** (VARCHAR) - OfferLogix products/solutions interest
3. **campaigns.handover_criteria** (JSONB) - Intent-based handover triggers

### Tables Created
1. **security_events** - Security monitoring and alerting system with proper indexes

### Indexes Added
- Performance indexes on foreign keys and commonly queried fields
- Multi-tenant support indexes (client_id)
- Status and filtering indexes

## Scripts Available

### 1. Migration Runner (`scripts/run-migration.ts`)
TypeScript migration runner with safety features:
- Dry-run mode for testing
- Verbose logging
- Automatic verification
- Production safeguards

### 2. Local Test Script (`scripts/test-migration-local.sh`)
Bash script for testing migrations on local database:
- Pre-flight checks
- Interactive confirmation
- Step-by-step execution
- Post-migration verification

### 3. Production Deployment (`scripts/deploy-migration-production.sh`)
Production-ready deployment script with:
- Automatic backups
- Safety confirmations
- Rollback instructions
- Comprehensive verification

## Usage

### Local Development Testing

1. **Check current schema status:**
   ```bash
   npx tsx scripts/run-migration.ts --info
   ```

2. **Dry run (see what would change):**
   ```bash
   npx tsx scripts/run-migration.ts --dry-run
   ```

3. **Run migration with verification:**
   ```bash
   npx tsx scripts/run-migration.ts --verify --verbose
   ```

4. **Use the automated test script:**
   ```bash
   ./scripts/test-migration-local.sh
   ```

### Production Deployment

1. **Set production environment:**
   ```bash
   export NODE_ENV=production
   export DATABASE_URL_PRODUCTION="postgresql://..."
   ```

2. **Run production deployment script:**
   ```bash
   ./scripts/deploy-migration-production.sh
   ```

   This will:
   - Create a backup
   - Run dry-run first
   - Request confirmation
   - Execute migration
   - Verify results

3. **Manual production migration (alternative):**
   ```bash
   npx tsx scripts/run-migration.ts --production --verify
   ```

## Migration Safety Features

### Idempotency
The migration is fully idempotent - it can be run multiple times safely:
- Checks for existence before adding columns
- Checks for existence before creating tables
- Uses IF NOT EXISTS for all DDL operations

### Transaction Safety
All changes are wrapped in a transaction:
- BEGIN at start
- COMMIT only if successful
- Automatic ROLLBACK on any error

### Verification
Built-in verification queries check:
- Column existence
- Table existence
- Index creation
- Data integrity

## Backup and Recovery

### Before Migration
The production deployment script automatically creates backups:
```bash
backups/backup_before_migration_YYYYMMDD_HHMMSS.sql
```

### Manual Backup
```bash
pg_dump $DATABASE_URL \
  --schema-only \
  --table=ai_agent_config \
  --table=leads \
  --table=campaigns \
  --table=security_events \
  > backup.sql
```

### Restore from Backup
```bash
psql $DATABASE_URL < backups/backup_file.sql
```

## TypeScript Schema Alignment

The `shared/schema.ts` file has been verified to match the database schema:

| Database Column | TypeScript Property | Type |
|-----------------|-------------------|------|
| ai_agent_config.from_name | fromName | text |
| leads.product_interest | productInterest | varchar |
| campaigns.handover_criteria | handoverCriteria | jsonb |
| security_events.* | securityEvents | table |

## Troubleshooting

### Connection Issues
- Verify DATABASE_URL is set correctly
- Check network connectivity
- Ensure database credentials are valid

### Permission Issues
- User must have ALTER TABLE permissions
- User must have CREATE TABLE permissions
- User must have CREATE INDEX permissions

### Migration Fails
1. Check error message in output
2. Review backup location
3. Verify schema requirements
4. Contact backend architect if needed

## Post-Migration Checklist

- [ ] Migration completed without errors
- [ ] All verification checks passed
- [ ] Application tested and working
- [ ] No errors in application logs
- [ ] Backup saved and documented
- [ ] Team notified of changes

## Support

For issues or questions about this migration:
1. Check the error logs
2. Review this documentation
3. Consult the backend architect
4. Keep backups for at least 7 days