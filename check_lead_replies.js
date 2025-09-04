import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkLeadReplies() {
  try {
    console.log('🔍 Checking for recent lead replies...\n');
    
    // Check recent conversation messages from leads (not AI) - using integer comparison
    const result = await pool.query(`
      SELECT 
        cm.id,
        cm.conversation_id,
        cm.content,
        cm.created_at,
        cm.is_from_ai,
        c.subject,
        l.email as lead_email,
        l.first_name,
        l.last_name
      FROM conversation_messages cm
      JOIN conversations c ON cm.conversation_id = c.id
      LEFT JOIN leads l ON c.lead_id = l.id
      WHERE cm.is_from_ai = 0 
      AND cm.created_at > NOW() - INTERVAL '24 hours'
      ORDER BY cm.created_at DESC
      LIMIT 20
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No lead replies found in the last 24 hours');
      console.log('\n📊 Checking total conversation messages...');
      
      const totalResult = await pool.query(`
        SELECT COUNT(*) as total_messages,
               COUNT(CASE WHEN is_from_ai = 0 THEN 1 END) as lead_messages,
               COUNT(CASE WHEN is_from_ai = 1 THEN 1 END) as ai_messages
        FROM conversation_messages
      `);
      
      console.log(`Total messages: ${totalResult.rows[0].total_messages}`);
      console.log(`Lead messages: ${totalResult.rows[0].lead_messages}`);
      console.log(`AI messages: ${totalResult.rows[0].ai_messages}`);
      
      if (parseInt(totalResult.rows[0].total_messages) === 0) {
        console.log('\n🚨 No messages found in the database at all!');
        console.log('This suggests either:');
        console.log('1. No inbound emails have been processed yet');
        console.log('2. The inbound email processing is not working');
        console.log('3. Messages are being stored elsewhere');
      }
      
    } else {
      console.log(`✅ Found ${result.rows.length} recent lead replies:\n`);
      
      result.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.created_at.toISOString()}`);
        console.log(`   Lead: ${row.lead_email || 'Unknown'} (${row.first_name || ''} ${row.last_name || ''})`.trim());
        console.log(`   Subject: ${row.subject || 'No subject'}`);
        console.log(`   Content: ${row.content ? row.content.substring(0, 100) + '...' : 'No content'}`);
        console.log('');
      });
    }
    
    // Check for any recent inbound email processing logs
    console.log('\n🔍 Checking for recent conversations...');
    const convResult = await pool.query(`
      SELECT 
        id,
        subject,
        created_at,
        updated_at,
        lead_id,
        status
      FROM conversations 
      WHERE created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (convResult.rows.length === 0) {
      console.log('❌ No recent conversations found');
    } else {
      console.log(`✅ Found ${convResult.rows.length} recent conversations:\n`);
      convResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.created_at.toISOString()} - ${row.subject || 'No subject'} (${row.status})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking lead replies:', error);
  } finally {
    await pool.end();
  }
}

checkLeadReplies();
