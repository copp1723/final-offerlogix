#!/bin/bash

# MailMind Database Migration Script
# Runs all migrations in correct order with error handling and rollback support

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_ROOT/drizzle"
BACKUP_FILE="/tmp/mailmind_backup_$(date +%Y%m%d_%H%M%S).sql"
LOG_FILE="/tmp/mailmind_migration_$(date +%Y%m%d_%H%M%S).log"

# Migration files in correct order
MIGRATIONS=(
    "0001_initial_schema.sql"
    "0002_schema_updates.sql"
    "0003_model_default_update.sql"
    "0004_performance_indexes.sql"
    "0005_data_integrity_constraints.sql"
    "0006_add_templates_table.sql"
    "0006_security_improvements.sql"
    "0007_hotfix_conversations_columns.sql"
    "0008_model_default_gpt5_chat.sql"
    "0009_add_handover_prompt_spec.sql"
    "0010_security_and_api_keys.sql"
    "0011_email_reliability_system.sql"
    "0012_stop_on_complaint.sql"
    "0013_intent_handover.sql"
    "0014_add_provider_message_id.sql"
    "0015_campaign_send_window.sql"
    "0016_campaign_send_window.sql"
    "0017_auto_stop_followups.sql"
)

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if database is accessible
check_database() {
    print_status "Checking database connectivity..."
    
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL environment variable is not set"
        echo "Please set DATABASE_URL before running migrations:"
        echo "export DATABASE_URL='postgresql://user:pass@host:port/dbname'"
        exit 1
    fi
    
    if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        print_error "Cannot connect to database with DATABASE_URL: $DATABASE_URL"
        exit 1
    fi
    
    print_success "Database connection verified"
}

# Function to create backup
create_backup() {
    print_status "Creating database backup..."
    
    if pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>/dev/null; then
        print_success "Backup created: $BACKUP_FILE"
    else
        print_warning "Failed to create backup, but continuing with migrations"
        print_warning "Consider creating a manual backup before proceeding"
    fi
}

# Function to check if migration was already applied
is_migration_applied() {
    local migration_name="$1"
    local table_exists
    
    # Check if migrations tracking table exists
    table_exists=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'drizzle_migrations');" 2>/dev/null | xargs)
    
    if [ "$table_exists" = "t" ]; then
        # Check if specific migration was applied
        local applied=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT 1 FROM drizzle_migrations WHERE hash = '$migration_name');" 2>/dev/null | xargs)
        [ "$applied" = "t" ]
    else
        # No tracking table, assume not applied
        return 1
    fi
}

# Function to apply a single migration
apply_migration() {
    local migration_file="$1"
    local migration_path="$MIGRATIONS_DIR/$migration_file"
    
    if [ ! -f "$migration_path" ]; then
        print_warning "Migration file not found: $migration_path (skipping)"
        return 0
    fi
    
    print_status "Applying migration: $migration_file"
    
    # Check if already applied
    if is_migration_applied "$migration_file"; then
        print_success "Migration already applied: $migration_file (skipping)"
        return 0
    fi
    
    # Apply migration
    if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration_path" >> "$LOG_FILE" 2>&1; then
        # Record migration in tracking table
        psql "$DATABASE_URL" -c "INSERT INTO drizzle_migrations (hash, created_at) VALUES ('$migration_file', NOW()) ON CONFLICT (hash) DO NOTHING;" >> "$LOG_FILE" 2>&1 || true
        print_success "Applied migration: $migration_file"
        return 0
    else
        print_error "Failed to apply migration: $migration_file"
        print_error "Check log file: $LOG_FILE"
        return 1
    fi
}

# Function to create migrations tracking table
create_tracking_table() {
    print_status "Creating migrations tracking table..."
    
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 << 'EOF' >> "$LOG_FILE" 2>&1
CREATE TABLE IF NOT EXISTS drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
EOF
    
    if [ $? -eq 0 ]; then
        print_success "Migrations tracking table ready"
    else
        print_error "Failed to create migrations tracking table"
        exit 1
    fi
}

# Function to show migration status
show_migration_status() {
    print_status "Migration Status Summary:"
    echo "=========================="
    
    local total_migrations=${#MIGRATIONS[@]}
    local applied_count=0
    local skipped_count=0
    
    for migration in "${MIGRATIONS[@]}"; do
        local migration_path="$MIGRATIONS_DIR/$migration"
        
        if [ ! -f "$migration_path" ]; then
            printf "%-35s %s\n" "$migration" "${YELLOW}MISSING${NC}"
            ((skipped_count++))
        elif is_migration_applied "$migration"; then
            printf "%-35s %s\n" "$migration" "${GREEN}APPLIED${NC}"
            ((applied_count++))
        else
            printf "%-35s %s\n" "$migration" "${YELLOW}PENDING${NC}"
        fi
    done
    
    echo "=========================="
    echo "Total migrations: $total_migrations"
    echo "Applied: $applied_count"
    echo "Missing/Skipped: $skipped_count"
    echo "Pending: $((total_migrations - applied_count - skipped_count))"
}

# Function to rollback (restore from backup)
rollback() {
    if [ -f "$BACKUP_FILE" ]; then
        print_status "Rolling back database from backup..."
        if psql "$DATABASE_URL" < "$BACKUP_FILE" > /dev/null 2>&1; then
            print_success "Database rolled back successfully"
        else
            print_error "Failed to rollback database"
        fi
    else
        print_error "No backup file found for rollback"
    fi
}

# Function to show help
show_help() {
    echo "MailMind Database Migration Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --dry-run     Show what would be done without executing"
    echo "  --status      Show current migration status"
    echo "  --backup      Create backup only"
    echo "  --rollback    Rollback from backup (requires backup file)"
    echo "  --force       Skip confirmation prompts"
    echo "  --help        Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL  PostgreSQL connection string (required)"
    echo ""
    echo "Examples:"
    echo "  $0                          # Run all pending migrations"
    echo "  $0 --status                 # Show migration status"
    echo "  $0 --dry-run                # Preview what will be done"
    echo "  $0 --backup                 # Create backup only"
    echo ""
}

# Main execution function
main() {
    local dry_run=false
    local force=false
    local status_only=false
    local backup_only=false
    local rollback_requested=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                dry_run=true
                shift
                ;;
            --force)
                force=true
                shift
                ;;
            --status)
                status_only=true
                shift
                ;;
            --backup)
                backup_only=true
                shift
                ;;
            --rollback)
                rollback_requested=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Print header
    echo "======================================"
    echo "   MailMind Database Migration Tool   "
    echo "======================================"
    echo "Log file: $LOG_FILE"
    echo ""
    
    # Check database connectivity
    check_database
    
    # Handle special modes
    if [ "$rollback_requested" = true ]; then
        rollback
        exit 0
    fi
    
    if [ "$backup_only" = true ]; then
        create_backup
        exit 0
    fi
    
    # Create migrations tracking table
    create_tracking_table
    
    if [ "$status_only" = true ]; then
        show_migration_status
        exit 0
    fi
    
    # Show current status
    show_migration_status
    echo ""
    
    # Dry run mode
    if [ "$dry_run" = true ]; then
        print_status "DRY RUN MODE - No changes will be made"
        echo ""
        for migration in "${MIGRATIONS[@]}"; do
            local migration_path="$MIGRATIONS_DIR/$migration"
            if [ ! -f "$migration_path" ]; then
                print_warning "Would skip (missing): $migration"
            elif is_migration_applied "$migration"; then
                print_status "Would skip (applied): $migration"
            else
                print_success "Would apply: $migration"
            fi
        done
        exit 0
    fi
    
    # Confirmation prompt
    if [ "$force" = false ]; then
        echo ""
        read -p "Do you want to proceed with applying pending migrations? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Migration cancelled by user"
            exit 0
        fi
    fi
    
    # Create backup before applying migrations
    create_backup
    
    # Apply migrations
    print_status "Starting migration process..."
    echo ""
    
    local failed_migrations=()
    local applied_migrations=()
    
    for migration in "${MIGRATIONS[@]}"; do
        if apply_migration "$migration"; then
            applied_migrations+=("$migration")
        else
            failed_migrations+=("$migration")
            print_error "Migration failed: $migration"
            
            # Ask user if they want to continue or rollback
            if [ "$force" = false ]; then
                echo ""
                echo "Options:"
                echo "1) Continue with remaining migrations"
                echo "2) Rollback all changes"
                echo "3) Stop here (leave applied migrations in place)"
                read -p "Choose an option (1/2/3): " -n 1 -r choice
                echo ""
                
                case $choice in
                    2)
                        print_status "Rolling back all changes..."
                        rollback
                        exit 1
                        ;;
                    3)
                        print_status "Stopping migration process"
                        exit 1
                        ;;
                    *)
                        print_status "Continuing with remaining migrations..."
                        ;;
                esac
            else
                print_error "Migration failed in --force mode, stopping"
                exit 1
            fi
        fi
    done
    
    # Final status
    echo ""
    echo "======================================"
    print_success "Migration process completed!"
    echo "======================================"
    
    if [ ${#applied_migrations[@]} -gt 0 ]; then
        print_success "Successfully applied ${#applied_migrations[@]} migrations:"
        for migration in "${applied_migrations[@]}"; do
            echo "  ✓ $migration"
        done
    fi
    
    if [ ${#failed_migrations[@]} -gt 0 ]; then
        print_warning "Failed migrations (${#failed_migrations[@]}):"
        for migration in "${failed_migrations[@]}"; do
            echo "  ✗ $migration"
        done
        echo ""
        print_warning "Some migrations failed. Check the log file: $LOG_FILE"
        echo "Backup available at: $BACKUP_FILE"
        exit 1
    fi
    
    echo ""
    print_success "All migrations completed successfully!"
    echo "Log file: $LOG_FILE"
    echo "Backup file: $BACKUP_FILE"
    
    # Show final status
    echo ""
    show_migration_status
}

# Trap to handle interruption
trap 'echo ""; print_error "Migration interrupted by user"; exit 1' INT TERM

# Run main function
main "$@"