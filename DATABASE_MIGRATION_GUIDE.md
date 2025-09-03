# OfferLogix Database Migration Guide

## Overview
This guide walks you through setting up the OfferLogix database as an exact copy of MailMind's database structure.

## Prerequisites
- PostgreSQL client tools installed (`psql`, `pg_dump`)
- Access to both MailMind and OfferLogix databases
- Database connection strings for both systems

## Migration Options

### Option A: Full Copy (Schema + Data)
Use this option if you want OfferLogix to have all the same data as MailMind, including:
- All existing clients
- All campaigns
- All leads and conversations
- All configuration data

### Option B: Schema Only (Clean Start)
Use this option if you want OfferLogix to start fresh with:
- Same database structure as MailMind
- No existing data (empty tables)
- Ready for new clients and campaigns

## Step-by-Step Instructions

### 1. Set Environment Variables

```bash
# MailMind database (source)
export MAILMIND_DATABASE_URL="postgresql://user:password@host:5432/mailmind_db"

# OfferLogix database (target)
export OFFERLOGIX_DATABASE_URL="postgresql://user:password@host:5432/offerlogix_db"
```

### 2. Run Migration Script

```bash
cd /Users/joshcopp/Desktop/Swarm/OFFERLOGIX
./migrate-database.sh
```

Choose option 1 or 2 when prompted.

### 3. Alternative: Manual Migration

#### For Full Copy:
```bash
# Dump MailMind database
pg_dump "$MAILMIND_DATABASE_URL" --clean --if-exists --no-owner --no-privileges > mailmind_dump.sql

# Restore to OfferLogix
psql "$OFFERLOGIX_DATABASE_URL" < mailmind_dump.sql
```

#### For Schema Only:
```bash
# Dump schema only
pg_dump "$MAILMIND_DATABASE_URL" --schema-only --clean --if-exists --no-owner --no-privileges > mailmind_schema.sql

# Restore schema
psql "$OFFERLOGIX_DATABASE_URL" < mailmind_schema.sql
```

### 4. Using Drizzle Migrations (Alternative)

If you prefer to use Drizzle migrations to create a fresh database:

```bash
cd /Users/joshcopp/Desktop/Swarm/OFFERLOGIX

# Update .env with your database URL
echo "DATABASE_URL=postgresql://user:password@host:5432/offerlogix_db" > .env

# Install dependencies
npm install

# Run all migrations
npm run db:push
# or
npx drizzle-kit push:pg
```

## Post-Migration Steps

### 1. Update Environment Configuration

Edit `/Users/joshcopp/Desktop/Swarm/OFFERLOGIX/.env`:

```env
DATABASE_URL=postgresql://your_user:your_password@your_host:5432/offerlogix_db

# Update other settings as needed:
MAILGUN_DOMAIN=mg.offerlogix.com
MAILGUN_FROM_EMAIL=agent@mg.offerlogix.com
# etc...
```

### 2. Verify Database Connection

```bash
cd /Users/joshcopp/Desktop/Swarm/OFFERLOGIX
npm run db:check
```

### 3. Test Locally

```bash
npm install
npm run dev
```

Visit http://localhost:3000 to verify the application works.

## Database Schema Overview

The database includes the following main tables:
- **clients**: Multi-tenant client management
- **users**: User accounts with role-based access
- **campaigns**: Email campaign configurations
- **leads**: Lead/prospect information
- **conversations**: Conversation threads
- **conversation_messages**: Individual messages
- **ai_agent_config**: AI agent configurations
- **email_queue**: Email delivery queue
- **templates**: Email templates

## Troubleshooting

### Connection Issues
- Ensure PostgreSQL is running
- Check firewall rules allow database connections
- Verify connection string format

### Migration Errors
- Check user has sufficient privileges
- Ensure target database exists
- Review error logs for specific issues

### Data Integrity
After migration, verify:
```sql
-- Check table counts
SELECT 'clients' as table_name, COUNT(*) as count FROM clients
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'campaigns', COUNT(*) FROM campaigns
UNION ALL
SELECT 'leads', COUNT(*) FROM leads;
```

## Rollback Procedure

If you need to rollback:

```bash
# Restore from backup
psql "$OFFERLOGIX_DATABASE_URL" < offerlogix_backup_YYYYMMDD_HHMMSS.sql
```

## Security Notes

- Never commit database URLs to git
- Use environment variables for sensitive data
- Rotate credentials after migration
- Enable SSL for production databases

## Next Steps

1. ✅ Database migrated
2. 📝 Update environment variables
3. 🚀 Deploy to Render
4. 🧪 Test all functionality
5. 📊 Monitor performance

## Support

For issues or questions:
- Check logs in `/logs` directory
- Review migration output for errors
- Verify network connectivity
- Ensure proper permissions