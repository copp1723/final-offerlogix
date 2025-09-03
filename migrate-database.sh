#!/bin/bash

# OfferLogix Database Migration Script
# Creates an exact copy of MailMind database

echo "OfferLogix Database Migration Tool"
echo "=================================="
echo ""

# Check if environment variables are set
if [ -z "$MAILMIND_DATABASE_URL" ]; then
    echo "Error: MAILMIND_DATABASE_URL is not set"
    echo "Please export MAILMIND_DATABASE_URL with the MailMind database connection string"
    exit 1
fi

if [ -z "$OFFERLOGIX_DATABASE_URL" ]; then
    echo "Error: OFFERLOGIX_DATABASE_URL is not set"
    echo "Please export OFFERLOGIX_DATABASE_URL with the OfferLogix database connection string"
    exit 1
fi

echo "Migration Options:"
echo "1. Full copy (schema + data)"
echo "2. Schema only (no data)"
echo ""
read -p "Choose an option (1 or 2): " option

# Create backup of OfferLogix database (if it exists)
echo ""
echo "Creating backup of OfferLogix database (if exists)..."
pg_dump "$OFFERLOGIX_DATABASE_URL" > offerlogix_backup_$(date +%Y%m%d_%H%M%S).sql 2>/dev/null || echo "No existing database to backup"

case $option in
    1)
        echo ""
        echo "Option 1: Full copy (schema + data)"
        echo "-----------------------------------"
        
        # Dump MailMind database
        echo "Dumping MailMind database..."
        pg_dump "$MAILMIND_DATABASE_URL" --clean --if-exists --no-owner --no-privileges > mailmind_full_dump.sql
        
        if [ $? -ne 0 ]; then
            echo "Error: Failed to dump MailMind database"
            exit 1
        fi
        
        # Restore to OfferLogix
        echo "Restoring to OfferLogix database..."
        psql "$OFFERLOGIX_DATABASE_URL" < mailmind_full_dump.sql
        
        if [ $? -ne 0 ]; then
            echo "Error: Failed to restore to OfferLogix database"
            exit 1
        fi
        
        echo "✅ Full database copy completed successfully!"
        ;;
        
    2)
        echo ""
        echo "Option 2: Schema only (no data)"
        echo "-------------------------------"
        
        # First do a full copy
        echo "Copying full database structure..."
        pg_dump "$MAILMIND_DATABASE_URL" --clean --if-exists --no-owner --no-privileges > mailmind_full_dump.sql
        
        if [ $? -ne 0 ]; then
            echo "Error: Failed to dump MailMind database"
            exit 1
        fi
        
        # Restore to OfferLogix
        echo "Restoring to OfferLogix database..."
        psql "$OFFERLOGIX_DATABASE_URL" < mailmind_full_dump.sql
        
        if [ $? -ne 0 ]; then
            echo "Error: Failed to restore to OfferLogix database"
            exit 1
        fi
        
        # Then truncate all data
        echo "Removing all data (keeping schema)..."
        psql "$OFFERLOGIX_DATABASE_URL" < truncate_except_migrations.sql
        
        if [ $? -ne 0 ]; then
            echo "Error: Failed to truncate tables"
            exit 1
        fi
        
        echo "✅ Schema-only copy completed successfully!"
        ;;
        
    *)
        echo "Invalid option selected"
        exit 1
        ;;
esac

echo ""
echo "Database migration completed!"
echo ""
echo "Next steps:"
echo "1. Update OFFERLOGIX/.env with DATABASE_URL=$OFFERLOGIX_DATABASE_URL"
echo "2. Configure deployment environment variables in Render"
echo "3. Test the application locally: cd OFFERLOGIX && npm install && npm run dev"