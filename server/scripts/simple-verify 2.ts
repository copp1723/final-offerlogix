// Simple verification script that sets DATABASE_URL before any imports
process.env.DATABASE_URL = "postgresql://offerlogix_db_user:0qVzb7nAW0Ue1ihbTniiMon1gCfesTK4@dpg-d2edm53uibrs73ft94l0-a.oregon-postgres.render.com/offerlogix_db?sslmode=require";

import { storage } from '../storage';

async function verifyConversations() {
  console.log('🔍 Verifying conversation cleanup...');

  try {
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
    } else {
      console.log('✅ No remaining Chat Widget Conversations');
    }

    if (exampleConvos.length === 1) {
      console.log('✅ Found exactly 1 "Example Convo" conversation');
      console.log(`  - ${exampleConvos[0].subject} (${exampleConvos[0].id})`);
    } else if (exampleConvos.length === 0) {
      console.log('❌ No "Example Convo" found');
    } else {
      console.log(`❌ Found ${exampleConvos.length} "Example Convo" conversations (should be 1)`);
    }

    // Show first few conversation subjects for reference
    console.log('\nFirst 10 conversation subjects:');
    conversations.slice(0, 10).forEach(conv => {
      console.log(`  - ${conv.subject}`);
    });

    if (chatWidgetConversations.length === 0 && exampleConvos.length === 1) {
      console.log('\n🎉 SUCCESS: Cleanup completed successfully!');
    } else {
      console.log('\n❌ FAILED: Cleanup did not complete as expected');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verifyConversations();
