#!/usr/bin/env node

/**
 * COMPLETE EMAIL THREADING FIX MIGRATION
 * This migration permanently fixes the email threading problem
 */

import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('🔧 FIXING EMAIL THREADING PERMANENTLY...\n');
  
  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  await client.connect();
  
  try {
    // Step 1: Add Message-ID columns to conversation_messages
    console.log('1. Adding Message-ID columns to conversation_messages...');
    await client.query(`
      DO $$ 
      BEGIN
        -- Add message_id column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversation_messages' AND column_name = 'message_id') THEN
          ALTER TABLE conversation_messages ADD COLUMN message_id VARCHAR;
          CREATE INDEX IF NOT EXISTS idx_conversation_messages_message_id ON conversation_messages(message_id);
        END IF;
        
        -- Add in_reply_to column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversation_messages' AND column_name = 'in_reply_to') THEN
          ALTER TABLE conversation_messages ADD COLUMN in_reply_to VARCHAR;
        END IF;
        
        -- Add references column if it doesn't exist (using quoted name because it's a reserved word)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversation_messages' AND column_name = 'references') THEN
          ALTER TABLE conversation_messages ADD COLUMN "references" TEXT;
        END IF;
        
        -- Add email_headers column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversation_messages' AND column_name = 'email_headers') THEN
          ALTER TABLE conversation_messages ADD COLUMN email_headers JSONB;
        END IF;
      END $$;
    `);
    console.log('✅ Added Message-ID columns to conversation_messages');
    
    // Step 2: Add threading columns to conversations
    console.log('2. Adding threading columns to conversations...');
    await client.query(`
      DO $$ 
      BEGIN
        -- Add thread_message_ids column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'thread_message_ids') THEN
          ALTER TABLE conversations ADD COLUMN thread_message_ids TEXT[];
        END IF;
        
        -- Add original_message_id column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'original_message_id') THEN
          ALTER TABLE conversations ADD COLUMN original_message_id VARCHAR;
        END IF;
      END $$;
    `);
    console.log('✅ Added threading columns to conversations');
    
    // Step 3: Generate Message-IDs for existing messages
    console.log('3. Generating Message-IDs for existing messages...');
    const domain = process.env.MAILGUN_DOMAIN || 'mail.offerlogix.me';
    const domainPart = domain.split('@').pop() || domain;
    
    const existingMessages = await client.query(`
      SELECT id, conversation_id, created_at, is_from_ai 
      FROM conversation_messages 
      WHERE message_id IS NULL 
      ORDER BY created_at ASC
    `);
    
    let messageCount = 0;
    for (const msg of existingMessages.rows) {
      const timestamp = new Date(msg.created_at).getTime();
      const random = Math.random().toString(36).substr(2, 9);
      const messageType = msg.is_from_ai ? 'ai-reply' : 'lead-msg';
      const messageId = `${messageType}-${msg.conversation_id}-${timestamp}-${random}@${domainPart}`;
      
      await client.query(`
        UPDATE conversation_messages 
        SET message_id = $1 
        WHERE id = $2
      `, [messageId, msg.id]);
      
      messageCount++;
    }
    console.log(`✅ Generated ${messageCount} Message-IDs for existing messages`);
    
    // Step 4: Update conversation threading metadata
    console.log('4. Updating conversation threading metadata...');
    const conversations = await client.query(`
      SELECT DISTINCT conversation_id 
      FROM conversation_messages 
      WHERE message_id IS NOT NULL
    `);
    
    let conversationCount = 0;
    for (const conv of conversations.rows) {
      // Get all message IDs for this conversation in chronological order
      const messages = await client.query(`
        SELECT message_id 
        FROM conversation_messages 
        WHERE conversation_id = $1 AND message_id IS NOT NULL
        ORDER BY created_at ASC
      `, [conv.conversation_id]);
      
      if (messages.rows.length > 0) {
        const messageIds = messages.rows.map(m => m.message_id);
        const originalMessageId = messageIds[0];
        
        await client.query(`
          UPDATE conversations 
          SET thread_message_ids = $1, original_message_id = $2
          WHERE id = $3
        `, [messageIds, originalMessageId, conv.conversation_id]);
        
        conversationCount++;
      }
    }
    console.log(`✅ Updated ${conversationCount} conversations with threading metadata`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ EMAIL THREADING MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('\n📊 SUMMARY:');
    console.log(`  • Added Message-ID columns to database tables`);
    console.log(`  • Generated ${messageCount} Message-IDs for existing messages`);
    console.log(`  • Updated ${conversationCount} conversations with threading metadata`);
    
    console.log('\n🔄 NEXT STEPS:');
    console.log('  1. Restart your application server in Render');
    console.log('  2. Test sending a campaign email');
    console.log('  3. Reply to that email');
    console.log('  4. Verify the reply stays in the same thread');
    
    console.log('\n✅ DATABASE MIGRATION COMPLETE!');
    console.log('   Email threading should now work correctly.');
    console.log('   Restart your service to apply code changes.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});