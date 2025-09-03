#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();

async function checkKunesCampaigns() {
  try {
    const { db } = await import('./server/db.js');
    const { campaigns } = await import('./shared/schema.js');
    const { like } = await import('drizzle-orm');
    
    console.log('🔍 Searching for KUNES campaigns...');
    
    const results = await db.select().from(campaigns).where(like(campaigns.name, '%KUNES%'));
    
    if (results.length === 0) {
      console.log('❌ No KUNES campaigns found');
      
      // Check for KUNES in lowercase
      const lowerResults = await db.select().from(campaigns).where(like(campaigns.name, '%kunes%'));
      if (lowerResults.length > 0) {
        console.log('✅ Found lowercase kunes campaigns:');
        lowerResults.forEach((campaign, index) => {
          console.log(`${index + 1}. ${campaign.name} (ID: ${campaign.id})`);
        });
      }
      
      // Check for "truck" related campaigns
      const truckResults = await db.select().from(campaigns).where(like(campaigns.name, '%truck%'));
      if (truckResults.length > 0) {
        console.log('🚛 Found truck-related campaigns:');
        truckResults.forEach((campaign, index) => {
          console.log(`${index + 1}. ${campaign.name} (ID: ${campaign.id})`);
        });
      }
      
      // Show all campaigns
      console.log('\n📋 All campaigns in database:');
      const allCampaigns = await db.select().from(campaigns);
      allCampaigns.forEach((campaign, index) => {
        console.log(`${index + 1}. ${campaign.name} (ID: ${campaign.id}) - Status: ${campaign.status}`);
      });
      
    } else {
      console.log('✅ Found KUNES campaigns:');
      results.forEach((campaign, index) => {
        console.log(`${index + 1}. ${campaign.name} (ID: ${campaign.id}) - Status: ${campaign.status}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking campaigns:', error);
  }
}

checkKunesCampaigns().catch(console.error);