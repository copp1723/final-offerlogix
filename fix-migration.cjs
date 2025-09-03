const { Pool } = require('pg');

async function fixMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL + (process.env.DATABASE_URL?.includes('postgres.render.com') ? '?sslmode=require' : ''),
    ssl: process.env.DATABASE_URL?.includes('postgres.render.com') 
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    console.log('🔄 Connecting to database...');
    const client = await pool.connect();
    
    // First, check if lead_id column already exists
    console.log('🔍 Checking current table structure...');
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'conversation_messages'
    `);
    
    const hasLeadId = columnCheck.rows.some(row => row.column_name === 'lead_id');
    console.log('lead_id column exists:', hasLeadId);
    
    if (!hasLeadId) {
      // Step 1: Add lead_id column (nullable)
      console.log('➕ Adding lead_id column...');
      await client.query('ALTER TABLE conversation_messages ADD COLUMN lead_id VARCHAR REFERENCES leads(id)');
      
      // Step 2: Make sender_id nullable
      console.log('🔧 Making sender_id nullable...');
      await client.query('ALTER TABLE conversation_messages ALTER COLUMN sender_id DROP NOT NULL');
      
      // Step 3: Add index for performance
      console.log('📊 Adding index for lead_id...');
      await client.query('CREATE INDEX idx_conversation_messages_lead_id ON conversation_messages(lead_id)');
      
      console.log('✅ Schema migration completed successfully!');
    } else {
      console.log('⚠️ Schema already migrated');
    }
    
    // Check current data state
    console.log('🔍 Checking data consistency...');
    const dataCheck = await client.query(`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(sender_id) as with_sender,
        COUNT(lead_id) as with_lead,
        COUNT(*) - COUNT(sender_id) - COUNT(lead_id) as with_neither
      FROM conversation_messages
    `);
    
    console.log('Data summary:', dataCheck.rows[0]);
    
    client.release();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Load environment variables  
require('dotenv').config();
fixMigration().catch(console.error);