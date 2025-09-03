#!/bin/bash

# Database Setup Script for MailMind
# Runs all migrations in proper order and sets up initial data

set -e  # Exit on any error

echo "🗄️  Setting up MailMind database..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set in environment"
    echo "Please set DATABASE_URL in your .env file"
    exit 1
fi

# Check if database is accessible
echo "🔍 Checking database connection..."
if ! npx drizzle-kit studio --port 0 --timeout 5000 > /dev/null 2>&1; then
    echo "❌ Cannot connect to database"
    echo "Please check your DATABASE_URL and ensure PostgreSQL is running"
    exit 1
fi

echo "✅ Database connection successful"

# Run migrations in order
echo "🚀 Running database migrations..."

MIGRATION_DIR="./drizzle"
MIGRATIONS=(
    "0001_initial_schema.sql"
    "0002_schema_updates.sql" 
    "0003_model_default_update.sql"
    "0004_performance_indexes.sql"
    "0005_data_integrity_constraints.sql"
    "0006_security_improvements.sql"
    "0007_hotfix_conversations_columns.sql"
    "0008_model_default_gpt5_chat.sql"
    "0009_add_handover_prompt_spec.sql"
    "0010_security_and_api_keys.sql"
)

# Function to run SQL file
run_migration() {
    local file="$1"
    local filepath="$MIGRATION_DIR/$file"
    
    if [ -f "$filepath" ]; then
        echo "📄 Running migration: $file"
        if command -v psql > /dev/null; then
            psql "$DATABASE_URL" -f "$filepath" -v ON_ERROR_STOP=1 > /dev/null
        else
            # Fallback to node if psql not available
            node -e "
                const { Client } = require('pg');
                const fs = require('fs');
                const client = new Client({ connectionString: process.env.DATABASE_URL });
                client.connect().then(() => {
                    const sql = fs.readFileSync('$filepath', 'utf8');
                    return client.query(sql);
                }).then(() => {
                    console.log('✅ Migration completed: $file');
                    client.end();
                }).catch(err => {
                    console.error('❌ Migration failed: $file', err.message);
                    client.end();
                    process.exit(1);
                });
            "
        fi
        echo "✅ Completed: $file"
    else
        echo "⚠️  Migration file not found: $filepath"
    fi
}

# Run all migrations
for migration in "${MIGRATIONS[@]}"; do
    run_migration "$migration"
done

# Create sessions table for connect-pg-simple
echo "📄 Creating sessions table..."
if [ -f "./node_modules/connect-pg-simple/table.sql" ]; then
    if command -v psql > /dev/null; then
        psql "$DATABASE_URL" -f "./node_modules/connect-pg-simple/table.sql" -v ON_ERROR_STOP=1 > /dev/null 2>&1 || echo "⚠️  Sessions table may already exist"
    else
        node -e "
            const { Client } = require('pg');
            const fs = require('fs');
            const client = new Client({ connectionString: process.env.DATABASE_URL });
            client.connect().then(() => {
                const sql = fs.readFileSync('./node_modules/connect-pg-simple/table.sql', 'utf8');
                return client.query(sql);
            }).then(() => {
                console.log('✅ Sessions table created');
                client.end();
            }).catch(err => {
                if (err.message.includes('already exists')) {
                    console.log('⚠️  Sessions table already exists');
                } else {
                    console.error('❌ Sessions table creation failed:', err.message);
                }
                client.end();
            });
        "
    fi
fi

# Verify essential tables exist
echo "🔍 Verifying database schema..."
node -e "
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    
    const requiredTables = [
        'users', 'clients', 'campaigns', 'leads', 'conversations', 
        'conversation_messages', 'ai_agent_config', 'rate_limit_records', 
        'api_keys', 'security_events', 'session'
    ];
    
    client.connect().then(async () => {
        const result = await client.query(\`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        \`);
        
        const existingTables = result.rows.map(row => row.table_name);
        const missingTables = requiredTables.filter(table => !existingTables.includes(table));
        
        if (missingTables.length === 0) {
            console.log('✅ All required tables exist');
            console.log('📊 Database tables:', existingTables.join(', '));
        } else {
            console.log('⚠️  Missing tables:', missingTables.join(', '));
        }
        
        client.end();
    }).catch(err => {
        console.error('❌ Schema verification failed:', err.message);
        client.end();
        process.exit(1);
    });
"

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs
touch logs/security.log
chmod 644 logs/security.log

# Create data directory for uploads
echo "📁 Creating data directories..."
mkdir -p data/uploads
mkdir -p data/exports
chmod 755 data/uploads data/exports

echo ""
echo "🎉 Database setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Create an admin user: npm run auth:setup"
echo "2. Run tests: npm test"
echo "3. Start the application: npm run dev"
echo ""