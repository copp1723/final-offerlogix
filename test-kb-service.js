const axios = require('axios');

// Test script for Knowledge Base service
const API_BASE = 'http://localhost:3000/api/knowledge-base';

async function testKnowledgeBaseService() {
  console.log('🧪 Testing Knowledge Base Service...');
  
  const testClientId = '550e8400-e29b-41d4-a716-446655440000'; // Mock UUID
  
  try {
    // Test 1: Create a knowledge base
    console.log('\\n1. Creating knowledge base...');
    const createKbResponse = await axios.post(API_BASE, {
      name: 'Test Automotive Knowledge Base',
      description: 'Test KB for automotive sales content',
      clientId: testClientId,
      settings: {
        autoIndex: true,
        chunkSize: 1000
      }
    });
    
    const knowledgeBaseId = createKbResponse.data.id;
    console.log('✅ Knowledge base created:', knowledgeBaseId);
    
    // Test 2: Add a document
    console.log('\\n2. Adding document...');
    const addDocResponse = await axios.post(`${API_BASE}/documents`, {
      knowledgeBaseId,
      title: 'Toyota Camry 2024 Features',
      content: `The 2024 Toyota Camry offers exceptional fuel efficiency with up to 32 MPG combined. 
      Key features include Toyota Safety Sense 2.0, wireless Apple CarPlay, and a spacious interior.
      The hybrid variant achieves up to 52 MPG and includes advanced driver assistance features.
      Starting price is $25,295 with multiple trim levels available including LE, SE, XLE, and XSE.
      The vehicle comes with Toyota's 3-year/36,000-mile basic warranty and 5-year/60,000-mile powertrain warranty.`,
      documentType: 'note',
      tags: ['toyota', 'camry', '2024', 'features', 'pricing'],
      containerTags: ['automotive', 'vehicles', 'toyota'],
      metadata: {
        category: 'vehicle-specs',
        model: 'camry',
        year: 2024,
        make: 'toyota'
      }
    });
    
    const documentId = addDocResponse.data.id;
    console.log('✅ Document added:', documentId);
    
    // Test 3: Wait for processing (simulate)
    console.log('\\n3. Waiting for document processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 4: Search knowledge base
    console.log('\\n4. Searching knowledge base...');
    const searchResponse = await axios.post(`${API_BASE}/search`, {
      query: 'Toyota Camry fuel efficiency MPG',
      clientId: testClientId,
      knowledgeBaseIds: [knowledgeBaseId],
      limit: 5
    });
    
    console.log('✅ Search results:', searchResponse.data.total, 'results found');
    console.log('Search source:', searchResponse.data.source);
    
    // Test 5: Get all knowledge bases for client
    console.log('\\n5. Getting client knowledge bases...');
    const getKbResponse = await axios.get(`${API_BASE}/${testClientId}`);
    console.log('✅ Found', getKbResponse.data.length, 'knowledge bases');
    
    // Test 6: Get documents in knowledge base
    console.log('\\n6. Getting documents...');
    const getDocsResponse = await axios.get(`${API_BASE}/${knowledgeBaseId}/documents`);
    console.log('✅ Found', getDocsResponse.data.length, 'documents');
    
    console.log('\\n🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run tests if server is running
if (require.main === module) {
  testKnowledgeBaseService().catch(console.error);
}

module.exports = { testKnowledgeBaseService };