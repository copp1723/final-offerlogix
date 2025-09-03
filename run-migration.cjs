const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL + (process.env.DATABASE_URL?.includes('postgres.render.com') ? '?sslmode=require' : ''),
    ssl: process.env.DATABASE_URL?.includes('postgres.render.com') 
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    console.log('🔄 Connecting to database...');
    const client = await pool.connect();
    
    console.log('📖 Reading migration file...');
    const migrationSQL = fs.readFileSync(path.join(__dirname, 'drizzle/0023_add_from_name_field.sql'), 'utf8');
    
    console.log('🚀 Executing migration...');
    await client.query(migrationSQL);
    
    console.log('✅ Migration executed successfully!');
    client.release();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.message.includes('already exists')) {
      console.log('🔄 Column may already exist, continuing...');
    } else {
      throw error;
    }
  } finally {
    await pool.end();
  }
}

// Load environment variables
require('dotenv').config();
runMigration().catch(console.error);