#!/usr/bin/env node

// Script to add leads to The Direct Hit-Ford campaign and start the cadence

const API_BASE = 'http://localhost:5050/api';
const FORD_CAMPAIGN_ID = 'ee876452-9ce3-42d4-94d2-252feafe9639';

const leads = [
  { email: 'Caryn.ladd@gmail.com' },
  { email: 'jon.gregory3861@gmail.com' },
  { email: 'appleoptin@gmail.com' },
  { email: 'abickart@gmail.com' }
];

async function makeRequest(url, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  }
  
  return data;
}

async function createLead(leadData) {
  console.log(`Creating lead: ${leadData.email}`);
  try {
    const lead = await makeRequest(`${API_BASE}/leads`, 'POST', {
      email: leadData.email,
      firstName: leadData.firstName || '',
      lastName: leadData.lastName || '',
      phone: leadData.phone || '',
      vehicleInterest: leadData.vehicleInterest || 'Ford',
      leadSource: 'manual_entry',
      status: 'new',
      campaignId: FORD_CAMPAIGN_ID
    });
    console.log(`✅ Created lead: ${lead.email} (ID: ${lead.id})`);
    return lead;
  } catch (error) {
    console.error(`❌ Failed to create lead ${leadData.email}:`, error.message);
    return null;
  }
}

async function executeCampaign() {
  console.log(`\n🚀 Starting Ford campaign execution...`);
  try {
    const result = await makeRequest(`${API_BASE}/campaigns/${FORD_CAMPAIGN_ID}/execute`, 'POST', {
      testMode: false,
      maxLeadsPerBatch: 50
    });
    console.log(`✅ Campaign executed successfully!`);
    console.log(`📧 Emails sent: ${result.emailsSent || 0}`);
    console.log(`📊 Total leads: ${result.totalLeads || 0}`);
    if (result.errors && result.errors.length > 0) {
      console.log(`⚠️  Errors: ${result.errors.join(', ')}`);
    }
    return result;
  } catch (error) {
    console.error(`❌ Failed to execute campaign:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🎯 Adding leads to The Direct Hit-Ford campaign...\n');
  
  const createdLeads = [];
  
  // Create all leads
  for (const leadData of leads) {
    const lead = await createLead(leadData);
    if (lead) {
      createdLeads.push(lead);
    }
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`✅ Successfully created: ${createdLeads.length} leads`);
  console.log(`❌ Failed: ${leads.length - createdLeads.length} leads`);
  
  if (createdLeads.length > 0) {
    // Execute the campaign to start the cadence
    await executeCampaign();
  } else {
    console.log('❌ No leads were created, skipping campaign execution');
  }
  
  console.log('\n🎉 Process completed!');
}

// Run the script
main().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
