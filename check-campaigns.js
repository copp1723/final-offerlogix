import dotenv from 'dotenv';
dotenv.config();

async function checkCampaigns() {
  try {
    const { db } = await import('./server/db.js');
    const { campaigns } = await import('./shared/schema.js');
    
    console.log('🔍 Checking campaigns...');
    const result = await db.select().from(campaigns);
    
    console.log(`Found ${result.length} campaigns:`);
    result.forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.name} (ID: ${campaign.id}) - Status: ${campaign.status}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkCampaigns();
