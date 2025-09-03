const { Pool } = require('pg');

async function cleanData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL + (process.env.DATABASE_URL?.includes('postgres.render.com') ? '?sslmode=require' : ''),
    ssl: process.env.DATABASE_URL?.includes('postgres.render.com') 
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    console.log('🔄 Connecting to database...');
    const client = await pool.connect();
    
    // Check the problematic row
    console.log('🔍 Finding rows with missing sender/lead data...');
    const problemRows = await client.query(`
      SELECT id, conversation_id, sender_id, lead_id, content, created_at
      FROM conversation_messages 
      WHERE sender_id IS NULL AND lead_id IS NULL
    `);
    
    console.log(`Found ${problemRows.rows.length} problematic rows:`);
    problemRows.rows.forEach(row => {
      console.log(`- ID: ${row.id}, Content: "${row.content?.substring(0, 50)}..."`)
    });
    
    if (problemRows.rows.length > 0) {
      console.log('🗑️ Deleting rows with missing sender/lead data...');
      await client.query('DELETE FROM conversation_messages WHERE sender_id IS NULL AND lead_id IS NULL');
      console.log('✅ Cleaned up problematic rows');
    }
    
    // Now add the constraint
    console.log('✅ Adding check constraint...');
    try {
      await client.query(`
        ALTER TABLE conversation_messages 
        ADD CONSTRAINT check_sender_or_lead 
        CHECK (
          (sender_id IS NOT NULL AND lead_id IS NULL) OR 
          (sender_id IS NULL AND lead_id IS NOT NULL)
        )
      `);
      console.log('✅ Check constraint added successfully');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Constraint already exists');
      } else {
        throw error;
      }
    }
    
    // Verify final state
    console.log('🔍 Final verification...');
    const finalCheck = await client.query(`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(sender_id) as with_sender,
        COUNT(lead_id) as with_lead
      FROM conversation_messages
    `);
    
    console.log('✅ Final state:', finalCheck.rows[0]);
    
    client.release();
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Load environment variables  
require('dotenv').config();
cleanData().catch(console.error);