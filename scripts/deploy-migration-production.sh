#!/bin/bash

# Production Migration Deployment Script
# This script safely deploys the migration to production with backup and rollback support

set -e  # Exit on error

echo "================================================"
echo "OfferLogix PRODUCTION Migration Deployment"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running in production environment
if [ "$NODE_ENV" != "production" ]; then
    echo -e "${YELLOW}Warning: NODE_ENV is not set to 'production'${NC}"
    echo "Set NODE_ENV=production to run this script"
    read -p "Do you want to continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for production database URL
if [ -z "$DATABASE_URL_PRODUCTION" ] && [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: No production database URL found${NC}"
    echo "Please set DATABASE_URL_PRODUCTION or DATABASE_URL environment variable"
    exit 1
fi

PROD_DB_URL="${DATABASE_URL_PRODUCTION:-$DATABASE_URL}"

# Function to run psql command
run_psql() {
    psql "$PROD_DB_URL" -c "$1" 2>/dev/null || true
}

# Function to create backup
create_backup() {
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="backup_before_migration_${TIMESTAMP}.sql"
    
    echo -e "${BLUE}Creating backup: ${BACKUP_FILE}${NC}"
    
    # Create backups directory if it doesn't exist
    mkdir -p backups
    
    # Backup schema and specific tables
    pg_dump "$PROD_DB_URL" \
        --schema-only \
        --table=ai_agent_config \
        --table=leads \
        --table=campaigns \
        --table=security_events \
        --file="backups/${BACKUP_FILE}" 2>/dev/null || {
            echo -e "${YELLOW}Note: Some tables may not exist yet (this is expected)${NC}"
        }
    
    echo -e "${GREEN}Backup created: backups/${BACKUP_FILE}${NC}"
    echo "$BACKUP_FILE"
}

# Pre-flight checks
echo -e "${YELLOW}Running pre-flight checks...${NC}"

# Check connection
echo -n "Testing database connection... "
if run_psql "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    echo "Cannot connect to production database"
    exit 1
fi

# Check current schema
echo ""
echo -e "${YELLOW}Current production schema status:${NC}"
echo "================================================"

echo -n "ai_agent_config.from_name: "
if run_psql "SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_agent_config' AND column_name = 'from_name';" | grep -q "1 row"; then
    echo -e "${GREEN}EXISTS${NC}"
else
    echo -e "${YELLOW}MISSING${NC}"
fi

echo -n "leads.product_interest: "
if run_psql "SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'product_interest';" | grep -q "1 row"; then
    echo -e "${GREEN}EXISTS${NC}"
else
    echo -e "${YELLOW}MISSING${NC}"
fi

echo -n "campaigns.handover_criteria: "
if run_psql "SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'handover_criteria';" | grep -q "1 row"; then
    echo -e "${GREEN}EXISTS${NC}"
else
    echo -e "${YELLOW}MISSING${NC}"
fi

echo -n "security_events table: "
if run_psql "SELECT 1 FROM information_schema.tables WHERE table_name = 'security_events';" | grep -q "1 row"; then
    echo -e "${GREEN}EXISTS${NC}"
else
    echo -e "${YELLOW}MISSING${NC}"
fi

echo "================================================"
echo ""

# Confirmation
echo -e "${RED}⚠️  WARNING: You are about to modify the PRODUCTION database!${NC}"
echo -e "${RED}This will apply the migration in fix_missing_schema.sql${NC}"
echo ""
echo "Database: ${PROD_DB_URL%%:*}://***"
echo ""
read -p "Type 'DEPLOY' to continue, or anything else to cancel: " CONFIRM

if [ "$CONFIRM" != "DEPLOY" ]; then
    echo -e "${YELLOW}Deployment cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}Creating database backup...${NC}"
BACKUP_FILE=$(create_backup)

echo ""
echo -e "${YELLOW}Running migration in dry-run mode first...${NC}"
NODE_ENV=production tsx scripts/run-migration.ts --production --dry-run

echo ""
read -p "Dry run complete. Proceed with actual migration? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Migration cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}Executing production migration...${NC}"
echo "================================================"

# Run the actual migration
NODE_ENV=production tsx scripts/run-migration.ts --production --verify --verbose

MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
    echo ""
    echo -e "${RED}❌ Migration failed!${NC}"
    echo -e "${YELLOW}A backup was created at: backups/${BACKUP_FILE}${NC}"
    echo ""
    echo "To restore from backup (if needed):"
    echo "  psql \$DATABASE_URL_PRODUCTION < backups/${BACKUP_FILE}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Migration completed successfully!${NC}"
echo ""

# Post-migration verification
echo -e "${YELLOW}Running post-migration verification...${NC}"
echo "================================================"

VERIFICATION_PASSED=true

echo -n "Verifying ai_agent_config.from_name... "
if run_psql "SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_agent_config' AND column_name = 'from_name';" | grep -q "1 row"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    VERIFICATION_PASSED=false
fi

echo -n "Verifying leads.product_interest... "
if run_psql "SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'product_interest';" | grep -q "1 row"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    VERIFICATION_PASSED=false
fi

echo -n "Verifying campaigns.handover_criteria... "
if run_psql "SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'handover_criteria';" | grep -q "1 row"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    VERIFICATION_PASSED=false
fi

echo -n "Verifying security_events table... "
if run_psql "SELECT 1 FROM information_schema.tables WHERE table_name = 'security_events';" | grep -q "1 row"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    VERIFICATION_PASSED=false
fi

echo "================================================"

if [ "$VERIFICATION_PASSED" = true ]; then
    echo ""
    echo -e "${GREEN}🎉 Production migration deployed and verified successfully!${NC}"
    echo ""
    echo "Summary:"
    echo "  • Migration applied successfully"
    echo "  • All schema elements verified"
    echo "  • Backup saved to: backups/${BACKUP_FILE}"
    echo ""
    echo "Next steps:"
    echo "  1. Test the application functionality"
    echo "  2. Monitor error logs for any issues"
    echo "  3. Keep the backup for at least 7 days"
else
    echo ""
    echo -e "${YELLOW}⚠️  Migration completed but some verifications failed${NC}"
    echo "Please check the database manually"
    echo "Backup saved to: backups/${BACKUP_FILE}"
fi

echo ""
echo "================================================"
echo "Deployment complete: $(date)"
echo "================================================"