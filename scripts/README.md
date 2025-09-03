# MailMind Database Scripts

This directory contains scripts for managing database operations, data seeding, and migrations for the MailMind platform.

## 🗄️ Database Management Scripts

### Core Database Operations

- **`setup-database.sh`** - Initial database setup and schema creation
- **`db-doctor.ts`** - Database health check and repair utility
- **`create-admin-user.ts`** - Create administrative users

### Data Management Scripts

- **`seed-database.ts`** - Populate database with realistic sample data
- **`migrate-production-data.ts`** - Migrate and update existing production data
- **`reset-dev-data.ts`** - Reset development database with fresh data

## 📋 Available NPM Commands

```bash
# Database Setup & Maintenance
npm run db:setup          # Initial database setup
npm run db:migrate         # Run Drizzle migrations
npm run db:doctor          # Check and repair database

# Data Seeding & Migration
npm run db:seed            # Seed database with sample data
npm run db:migrate-prod    # Migrate production data
npm run db:reset-dev       # Reset development data (with confirmation)
npm run db:reset-quick     # Quick reset without confirmation

# User Management
npm run auth:setup         # Create admin user
```

## 🌱 Data Seeding

### Development Seeding (`npm run db:seed`)

Creates realistic sample data including:
- **2 Sample Clients**: Premier Auto Dealership, Metro Motors
- **3 Sample Users**: Admin, Manager, Sales roles
- **2 AI Configurations**: Customized for each client
- **3 Sample Campaigns**: SUV Promotion, Luxury Sedan, First-Time Buyer
- **3 Sample Leads**: Various stages and interests

**Sample Login Credentials:**
```
Username: admin_premier
Password: SecurePass123!

Username: manager_metro  
Password: SecurePass456!

Username: sales_premier
Password: SecurePass789!
```

### Production Migration (`npm run db:migrate-prod`)

Safely migrates existing production data:
- Updates client branding configurations
- Adds missing user notification preferences
- Ensures campaigns have proper context and goals
- Validates and fixes lead status and tags
- Creates AI agent configurations for clients

**Safety Features:**
- ✅ Non-destructive updates only
- ✅ Data validation after migration
- ✅ Detailed logging of all changes
- ✅ Error handling and rollback support

## 🔄 Development Data Reset

### Interactive Reset (`npm run db:reset-dev`)

Completely resets development database with safety checks:
- ⚠️ Requires explicit confirmation
- 🛡️ Prevents running in production
- 🧹 Clears all existing data
- 🌱 Seeds fresh sample data
- 💬 Creates sample conversations

### Quick Reset (`npm run db:reset-quick`)

Fast reset for CI/testing environments:
- ⚡ No confirmation required
- 🤖 Suitable for automated testing
- 🔒 Still prevents production usage

## 🛡️ Safety Features

### Environment Protection
```typescript
// Prevents accidental production runs
if (process.env.NODE_ENV === 'production') {
  console.error('❌ This script cannot be run in production');
  process.exit(1);
}
```

### Data Validation
- Foreign key constraint handling
- Data integrity checks
- Migration validation
- Error logging and reporting

### Backup Recommendations
```bash
# Before major operations, create backups
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# For production migrations
npm run db:migrate-prod 2>&1 | tee migration_$(date +%Y%m%d_%H%M%S).log
```

## 📊 Sample Data Structure

### Clients
- **Premier Auto Dealership** (premierauto.com)
  - Blue branding theme
  - Business hours: 8 AM - 6 PM EST
  - SMS integration enabled

- **Metro Motors** (metromotors.net)
  - Red branding theme  
  - Business hours: 9 AM - 7 PM CST
  - SMS integration disabled

### Campaigns
- **Spring SUV Promotion** - Family-focused SUV campaign
- **Luxury Sedan Showcase** - Executive/business professional targeting
- **First-Time Buyer Program** - Young adult/college graduate focus

### Leads
- **Sarah Johnson** - Hot lead interested in Honda CR-V
- **Michael Chen** - Warm lead looking at BMW 5 Series
- **Emily Rodriguez** - New lead considering Toyota Corolla

## 🔧 Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Check DATABASE_URL is set
echo $DATABASE_URL

# Test connection
npm run db:doctor
```

**Permission Errors**
```bash
# Make scripts executable
chmod +x scripts/*.sh
```

**Migration Failures**
```bash
# Check database state
npm run db:doctor

# View detailed logs
npm run db:migrate-prod 2>&1 | tee debug.log
```

### Recovery Procedures

**If seeding fails:**
```bash
# Clear and retry
npm run db:reset-quick
npm run db:seed
```

**If migration fails:**
```bash
# Restore from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# Re-run migration
npm run db:migrate-prod
```

## 🚀 Best Practices

1. **Always backup before major operations**
2. **Test migrations on staging first**
3. **Use quick reset for development iteration**
4. **Monitor logs during production migrations**
5. **Validate data after migrations**

## 📝 Script Development

When creating new database scripts:

```typescript
// Template structure
#!/usr/bin/env tsx

// Environment validation
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL required');
  process.exit(1);
}

// Production safety check
if (process.env.NODE_ENV === 'production' && isDestructive) {
  console.error('❌ Cannot run in production');
  process.exit(1);
}

// Main function with error handling
async function main() {
  try {
    // Script logic here
    console.log('✅ Operation completed');
  } catch (error) {
    console.error('❌ Operation failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Export for testing
export { main };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
```

## 📚 Additional Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Database Schema Reference](../server/db/schema.ts)
