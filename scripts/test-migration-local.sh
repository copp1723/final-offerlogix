#!/bin/bash

# Test Migration Script for Local Development
# This script tests the migration on a local database

set -e  # Exit on error

echo "================================================"
echo "OfferLogix Migration Test Script"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please create a .env file with DATABASE_URL"
    exit 1
fi

# Source environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL not set in .env${NC}"
    exit 1
fi

echo -e "${GREEN}Using database:${NC} ${DATABASE_URL%%@*}@..."
echo ""

# Function to run psql command
run_psql() {
    psql "$DATABASE_URL" -c "$1" 2>/dev/null || true
}

# Step 1: Check current schema status
echo -e "${YELLOW}Step 1: Checking current schema status...${NC}"
tsx scripts/run-migration.ts --info

echo ""
echo -e "${YELLOW}Step 2: Running migration in dry-run mode...${NC}"
tsx scripts/run-migration.ts --dry-run

echo ""
read -p "Do you want to proceed with the actual migration? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${YELLOW}Step 3: Running actual migration...${NC}"
    tsx scripts/run-migration.ts --verify --verbose
    
    echo ""
    echo -e "${YELLOW}Step 4: Final verification...${NC}"
    
    # Run verification queries
    echo "Checking ai_agent_config.from_name..."
    run_psql "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ai_agent_config' AND column_name = 'from_name';"
    
    echo "Checking leads.product_interest..."
    run_psql "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'product_interest';"
    
    echo "Checking campaigns.handover_criteria..."
    run_psql "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'handover_criteria';"
    
    echo "Checking security_events table..."
    run_psql "SELECT COUNT(*) as column_count FROM information_schema.columns WHERE table_name = 'security_events';"
    
    echo ""
    echo -e "${GREEN}✅ Migration test completed!${NC}"
else
    echo -e "${YELLOW}Migration cancelled.${NC}"
fi

echo ""
echo "================================================"
echo "Test complete"
echo "================================================"