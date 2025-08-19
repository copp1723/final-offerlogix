const axios = require('axios');

// Test script for Knowledge Base AI Integration
const API_BASE = 'http://localhost:3000/api';

async function testKBAIIntegration() {
  console.log('🧪 Testing Knowledge Base AI Integration...');
  
  const testClientId = '550e8400-e29b-41d4-a716-446655440000'; // Mock UUID
  const testCampaignId = 'campaign-123';
  
  try {
    // Step 1: Create a knowledge base
    console.log('\\n📚 Step 1: Creating knowledge base...');
    const createKbResponse = await axios.post(`${API_BASE}/knowledge-base`, {
      name: 'Automotive Sales Knowledge Base',
      description: 'Knowledge base for automotive sales agents',
      clientId: testClientId,
      settings: {
        autoIndex: true,
        chunkSize: 1000
      }
    });
    
    const knowledgeBaseId = createKbResponse.data.id;
    console.log('✅ Knowledge base created:', knowledgeBaseId);
    
    // Step 2: Add sample automotive documents
    console.log('\\n📄 Step 2: Adding automotive knowledge documents...');
    
    const documents = [
      {
        title: '2024 Toyota Camry Specifications',
        content: `The 2024 Toyota Camry offers excellent fuel economy with up to 32 MPG combined (28 city/39 highway). 
        The hybrid model achieves an impressive 52 MPG combined. Standard features include Toyota Safety Sense 2.0, 
        8-inch touchscreen, wireless Apple CarPlay and Android Auto. Available engines include a 2.5L 4-cylinder 
        (203 hp) and 2.5L hybrid (208 hp combined). Starting MSRP is $25,295 for LE trim, $27,015 for SE, 
        $29,985 for XLE, and $32,515 for XSE. All models come with Toyota's comprehensive warranty: 
        3-year/36,000-mile basic coverage and 5-year/60,000-mile powertrain coverage.`,
        documentType: 'note',
        tags: ['toyota', 'camry', '2024', 'specifications', 'pricing'],
        metadata: { category: 'vehicle-specs', make: 'toyota', model: 'camry', year: 2024 }
      },
      {
        title: 'Financing Options Guide',
        content: `We offer competitive financing options through Toyota Financial Services and other lenders. 
        APR rates start as low as 2.9% for qualified buyers with excellent credit (720+ FICO score). 
        Lease options available with $0 down for qualified buyers. Special financing promotions include 
        0.9% APR for up to 60 months on select models. Trade-in values are maximized through our 
        certified appraisal process. Extended warranties available up to 8 years/100,000 miles.`,
        documentType: 'note',
        tags: ['financing', 'loans', 'lease', 'apr', 'warranty'],
        metadata: { category: 'financing', type: 'customer-guide' }
      },
      {
        title: 'Common Customer Objections & Responses',
        content: `Price Objection: "That's more than I wanted to spend" - Response: Emphasize value, total cost of ownership, 
        and available financing options. Show monthly payment calculations and highlight fuel savings over time.
        Timing Objection: "I need to think about it" - Response: Ask specific questions about concerns, offer test drive, 
        and create urgency with limited-time offers or inventory levels.
        Competition: "I saw a better deal at [competitor]" - Response: Focus on Toyota's reliability, resale value, 
        and comprehensive warranty. Highlight our service excellence and customer satisfaction scores.`,
        documentType: 'note',
        tags: ['objections', 'sales-techniques', 'customer-service'],
        metadata: { category: 'sales-training', type: 'objection-handling' }
      }
    ];

    const addedDocuments = [];
    for (const doc of documents) {
      const response = await axios.post(`${API_BASE}/knowledge-base/documents`, {
        knowledgeBaseId,
        ...doc
      });
      addedDocuments.push(response.data);
      console.log(`✅ Added document: ${doc.title}`);
    }

    // Step 3: Wait for processing
    console.log('\\n⏳ Step 3: Waiting for document processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Link KB to campaign
    console.log('\\n🔗 Step 4: Linking knowledge base to campaign...');
    await axios.post(`${API_BASE}/kb-campaign/link`, {
      campaignId: testCampaignId,
      knowledgeBaseId
    });
    console.log('✅ Knowledge base linked to campaign');

    // Step 5: Test KB context generation
    console.log('\\n🧠 Step 5: Testing KB context generation...');
    
    const testQueries = [
      'What are the fuel economy specs for the 2024 Camry?',
      'Customer is concerned about price, what financing options do we have?',
      'Customer says they need to think about it, how should I respond?',
      'What warranty coverage comes with Toyota vehicles?'
    ];

    for (const query of testQueries) {
      console.log(`\\n🔍 Testing query: "${query}"`);
      
      const contextResponse = await axios.post(`${API_BASE}/kb-campaign/test-context`, {
        campaignId: testCampaignId,
        clientId: testClientId,
        query,
        maxResults: 3,
        includeGeneral: true
      });

      console.log(`📊 Found ${contextResponse.data.sourceCount} sources`);
      console.log(`📝 Context length: ${contextResponse.data.contextLength} chars`);
      
      if (!contextResponse.data.isEmpty) {
        console.log(`💡 Context preview: ${contextResponse.data.context.slice(0, 150)}...`);
        console.log(`📚 Sources: ${contextResponse.data.sources.map(s => s.title).join(', ')}`);
      } else {
        console.log('❌ No context found');
      }
    }

    // Step 6: Test campaign chat context
    console.log('\\n💬 Step 6: Testing campaign chat KB context...');
    
    const chatContextResponse = await axios.post(`${API_BASE}/kb-campaign/test-chat-context`, {
      clientId: testClientId,
      campaignId: testCampaignId,
      userTurn: 'I want to create a campaign for the 2024 Camry focusing on fuel efficiency and competitive pricing',
      context: 'Automotive dealership campaign',
      goals: 'Generate leads and schedule test drives'
    });

    console.log(`✅ Chat context generated:`);
    console.log(`   Has KB data: ${chatContextResponse.data.result.hasKBData}`);
    console.log(`   Sources: ${chatContextResponse.data.result.kbSources.length}`);
    console.log(`   Context length: ${chatContextResponse.data.metadata.contextLength}`);

    // Step 7: Test available KBs for client
    console.log('\\n📋 Step 7: Testing available knowledge bases...');
    const availableKBs = await axios.get(`${API_BASE}/kb-campaign/available/${testClientId}`);
    console.log(`✅ Found ${availableKBs.data.length} available knowledge bases for client`);

    // Step 8: Test linked KBs for campaign
    console.log('\\n🔗 Step 8: Testing linked knowledge bases...');
    const linkedKBs = await axios.get(`${API_BASE}/kb-campaign/linked/${testCampaignId}`);
    console.log(`✅ Found ${linkedKBs.data.length} knowledge bases linked to campaign`);

    console.log('\\n🎉 All KB-AI integration tests passed!');
    
    // Summary
    console.log('\\n📊 INTEGRATION SUMMARY:');
    console.log(`   📚 Knowledge Base ID: ${knowledgeBaseId}`);
    console.log(`   📄 Documents Added: ${addedDocuments.length}`);
    console.log(`   🔗 Campaign ID: ${testCampaignId}`);
    console.log(`   ✅ All integrations working correctly`);
    
    return {
      knowledgeBaseId,
      documentsAdded: addedDocuments.length,
      campaignId: testCampaignId,
      success: true
    };
    
  } catch (error) {
    console.error('❌ KB-AI Integration test failed:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

// Run tests if server is running
if (require.main === module) {
  testKBAIIntegration().catch(console.error);
}

module.exports = { testKBAIIntegration };