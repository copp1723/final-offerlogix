import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function debugAPI() {
  try {
    console.log('🔍 Debugging API vs Database mismatch...\n');
    
    // Get conversations from database
    console.log('1. Checking conversations in database...');
    const convResult = await pool.query(`
      SELECT id, subject, created_at, lead_id, status
      FROM conversations 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log(`   Found ${convResult.rows.length} conversations in database:`);
    convResult.rows.forEach((conv, i) => {
      console.log(`   ${i+1}. ${conv.id} - ${conv.subject || 'No subject'} (${conv.status})`);
    });
    
    if (convResult.rows.length > 0) {
      const firstConv = convResult.rows[0];
      
      console.log('\n2. Checking messages for first conversation...');
      const msgResult = await pool.query(`
        SELECT id, content, is_from_ai, created_at, sender_id
        FROM conversation_messages 
        WHERE conversation_id = $1
        ORDER BY created_at DESC
      `, [firstConv.id]);
      
      console.log(`   Messages in database: ${msgResult.rows.length}`);
      
      if (msgResult.rows.length > 0) {
        console.log('   Recent messages:');
        msgResult.rows.slice(0, 3).forEach((msg, i) => {
          const type = msg.is_from_ai ? 'AI' : 'Lead';
          const content = msg.content ? msg.content.substring(0, 60) + '...' : 'No content';
          console.log(`     ${i+1}. ${msg.created_at.toISOString()} - ${type}: ${content}`);
        });
      } else {
        console.log('   ❌ No messages found in database for this conversation');
      }
      
      // Test the exact query used by storage method
      console.log('\n3. Testing exact storage query...');
      const storageQuery = await pool.query(`
        SELECT * FROM conversation_messages 
        WHERE conversation_id = $1 
        ORDER BY created_at ASC
      `, [firstConv.id]);
      
      console.log(`   Storage-style query returned: ${storageQuery.rows.length} messages`);
      
      if (storageQuery.rows.length > 0) {
        console.log('   ✅ Database query works correctly');
        console.log('   Sample message from storage query:');
        const sample = storageQuery.rows[0];
        console.log(`     ID: ${sample.id}`);
        console.log(`     Content: ${sample.content ? sample.content.substring(0, 60) + '...' : 'No content'}`);
        console.log(`     Is from AI: ${sample.is_from_ai}`);
        console.log(`     Created: ${sample.created_at}`);
      } else {
        console.log('   ❌ Storage-style query returns empty');
      }
    }
    
    // Check if there are any messages at all
    console.log('\n4. Checking total messages in database...');
    const totalResult = await pool.query(`
      SELECT COUNT(*) as total_messages,
             COUNT(CASE WHEN is_from_ai = 0 THEN 1 END) as lead_messages,
             COUNT(CASE WHEN is_from_ai = 1 THEN 1 END) as ai_messages
      FROM conversation_messages
    `);
    
    console.log(`   Total messages: ${totalResult.rows[0].total_messages}`);
    console.log(`   Lead messages: ${totalResult.rows[0].lead_messages}`);
    console.log(`   AI messages: ${totalResult.rows[0].ai_messages}`);
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await pool.end();
  }
}

debugAPI();
