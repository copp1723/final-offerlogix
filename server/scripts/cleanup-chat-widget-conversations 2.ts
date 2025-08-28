// Load environment variables first, before any other imports
import { config } from 'dotenv';
config();

import { storage } from '../storage';

async function cleanupChatWidgetConversations() {
  console.log('🧹 Cleaning up Chat Widget Conversations...');

  // Get all conversations
  const conversations = await storage.getConversations();
  
  // Find all "Chat Widget Conversation" entries
  const chatWidgetConversations = conversations.filter(conv => 
    conv.subject.includes('Chat Widget Conversation')
  );

  console.log(`Found ${chatWidgetConversations.length} Chat Widget Conversations`);

  if (chatWidgetConversations.length === 0) {
    console.log('✅ No Chat Widget Conversations found to clean up.');
    return;
  }

  // Keep the first one and rename it to "Example Convo"
  const [keepConversation, ...deleteConversations] = chatWidgetConversations;

  // Update the kept conversation's subject
  await storage.updateConversation(keepConversation.id, {
    subject: 'Example Convo'
  });
  console.log(`✅ Updated conversation ${keepConversation.id} subject to "Example Convo"`);

  // Delete the rest
  for (const conv of deleteConversations) {
    await storage.deleteConversation(conv.id);
    console.log(`🗑️  Deleted conversation: ${conv.subject} (${conv.id})`);
  }

  console.log(`✅ Cleanup complete. Kept 1 conversation as "Example Convo", deleted ${deleteConversations.length} conversations.`);
}

// Execute when run directly (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupChatWidgetConversations().catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  });
}

export { cleanupChatWidgetConversations };
