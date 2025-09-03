const { Pool } = require('pg');

async function fixStatusConstraint() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL + (process.env.DATABASE_URL?.includes('postgres.render.com') ? '?sslmode=require' : ''),
    ssl: process.env.DATABASE_URL?.includes('postgres.render.com') 
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    console.log('🔧 Connecting to fix status constraint...');
    const client = await pool.connect();
    
    // Drop the restrictive constraint
    await client.query('ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_status_values_check;');
    console.log('✅ Removed restrictive status constraint');
    
    client.release();
    console.log('🎯 Webhook should work now - ready for retry');
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

require('dotenv').config();
fixStatusConstraint().catch(console.error);