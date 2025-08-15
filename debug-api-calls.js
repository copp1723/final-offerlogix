#!/usr/bin/env node

// Debug script to test API calls
import fetch from 'node-fetch';

async function testAPICalls() {
  console.log('🔍 Testing API calls...\n');
  
  const baseUrl = 'http://localhost:3000';
  
  try {
    // Test leads endpoint
    console.log('1. Testing GET /api/leads...');
    const leadsResponse = await fetch(`${baseUrl}/api/leads`);
    
    if (leadsResponse.ok) {
      const leads = await leadsResponse.json();
      console.log(`✅ API returned ${Array.isArray(leads) ? leads.length : 'non-array'} leads`);
      
      if (Array.isArray(leads) && leads.length > 0) {
        console.log('Sample leads from API:');
        leads.slice(0, 3).forEach((lead, i) => {
          console.log(`  ${i + 1}. ID: ${lead.id}, Email: ${lead.email}, Client: ${lead.clientId}`);
        });
      } else {
        console.log('No leads returned from API');
      }
    } else {
      console.log(`❌ API request failed: ${leadsResponse.status} ${leadsResponse.statusText}`);
      const errorText = await leadsResponse.text();
      console.log('Error response:', errorText);
    }
    console.log('');
    
    // Test individual lead creation
    console.log('2. Testing POST /api/leads...');
    const testLead = {
      email: `api-test-${Date.now()}@example.com`,
      firstName: 'API',
      lastName: 'Test',
      phone: '555-123-4567',
      vehicleInterest: 'Toyota Camry',
      leadSource: 'api_test'
    };
    
    const createResponse = await fetch(`${baseUrl}/api/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testLead)
    });
    
    if (createResponse.ok) {
      const createdLead = await createResponse.json();
      console.log('✅ Lead created successfully:', createdLead);
      
      // Test retrieving it again
      const refreshResponse = await fetch(`${baseUrl}/api/leads`);
      if (refreshResponse.ok) {
        const refreshedLeads = await refreshResponse.json();
        const foundLead = refreshedLeads.find(l => l.email === testLead.email);
        if (foundLead) {
          console.log('✅ Newly created lead found in GET /api/leads');
        } else {
          console.log('❌ Newly created lead NOT found in GET /api/leads');
          console.log('This indicates a filtering issue');
        }
      }
    } else {
      console.log(`❌ Create lead failed: ${createResponse.status} ${createResponse.statusText}`);
      const errorText = await createResponse.text();
      console.log('Error response:', errorText);
    }
    console.log('');
    
    // Test campaigns endpoint
    console.log('3. Testing GET /api/campaigns...');
    const campaignsResponse = await fetch(`${baseUrl}/api/campaigns`);
    
    if (campaignsResponse.ok) {
      const campaigns = await campaignsResponse.json();
      console.log(`✅ API returned ${Array.isArray(campaigns) ? campaigns.length : 'non-array'} campaigns`);
      
      if (Array.isArray(campaigns) && campaigns.length > 0) {
        console.log('Sample campaigns from API:');
        campaigns.slice(0, 2).forEach((campaign, i) => {
          console.log(`  ${i + 1}. ID: ${campaign.id}, Name: ${campaign.name}`);
        });
      }
    } else {
      console.log(`❌ Campaigns request failed: ${campaignsResponse.status} ${campaignsResponse.statusText}`);
    }
    
  } catch (error) {
    console.error('❌ Error during API testing:', error);
  }
}

testAPICalls().catch(console.error);