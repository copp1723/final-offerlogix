// Load environment variables first, before any other imports
import { config } from 'dotenv';
import path from 'path';

// Load from the .env file in the project root
config({ path: path.resolve(process.cwd(), '.env') });

// Debug: Check if DATABASE_URL is loaded
console.log('DATABASE_URL loaded:', !!process.env.DATABASE_URL);
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

import { storage } from '../storage';

async function verifyConversations() {
  console.log('🔍 Verifying conversation cleanup...');

  // Get all conversations
  const conversations = await storage.getConversations();
  
  console.log(`Total conversations: ${conversations.length}`);
  
  // Find any remaining "Chat Widget Conversation" entries
  const chatWidgetConversations = conversations.filter(conv => 
    conv.subject.includes('Chat Widget Conversation')
  );

  // Find "Example Convo" entries
  const exampleConvos = conversations.filter(conv => 
    conv.subject === 'Example Convo'
  );

  console.log(`Remaining "Chat Widget Conversation" entries: ${chatWidgetConversations.length}`);
  console.log(`"Example Convo" entries: ${exampleConvos.length}`);

  if (chatWidgetConversations.length > 0) {
    console.log('❌ Still have Chat Widget Conversations:');
    chatWidgetConversations.forEach(conv => {
      console.log(`  - ${conv.subject} (${conv.id})`);
    });
  }

  if (exampleConvos.length === 1) {
    console.log('✅ Found exactly 1 "Example Convo" conversation');
    console.log(`  - ${exampleConvos[0].subject} (${exampleConvos[0].id})`);
  } else if (exampleConvos.length === 0) {
    console.log('❌ No "Example Convo" found');
  } else {
    console.log(`❌ Found ${exampleConvos.length} "Example Convo" conversations (should be 1)`);
  }

  // Show all conversation subjects for reference
  console.log('\nAll conversation subjects:');
  conversations.forEach(conv => {
    console.log(`  - ${conv.subject}`);
  });
}

// Execute when run directly (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyConversations().catch((e) => {
    console.error('❌ Verification failed:', e);
    process.exit(1);
  });
}

export { verifyConversations };
