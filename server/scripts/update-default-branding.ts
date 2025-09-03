#!/usr/bin/env tsx

/**
 * Script to update default client branding from "OneKeel Swarm" to "MailMind"
 * Run this to update existing installations with the new branding
 */

import { db } from '../db';
import { clients } from '../../shared/schema';
import { eq, or } from 'drizzle-orm';

async function updateDefaultBranding() {
  console.log('🔄 Updating default client branding...');
  
  try {
    // Find clients with old branding
    const oldClients = await db.select()
      .from(clients)
      .where(
        or(
          eq(clients.name, 'Default Client'),
          eq(clients.domain, 'localhost')
        )
      );

    if (oldClients.length === 0) {
      console.log('ℹ️  No default clients found to update');
      return;
    }

    for (const client of oldClients) {
      const currentBranding = client.brandingConfig as any;
      
      // Check if branding needs updating
      if (currentBranding?.companyName === 'OneKeel Swarm' || 
          currentBranding?.companyName === 'AutoCampaigns AI') {
        
        const updatedBranding = {
          ...currentBranding,
          primaryColor: '#2563eb',
          secondaryColor: '#1e40af',
          logoUrl: '/logo.svg',
          companyName: 'MailMind',
          favicon: '',
          customCss: ''
        };

        await db.update(clients)
          .set({ 
            brandingConfig: updatedBranding,
            updatedAt: new Date()
          })
          .where(eq(clients.id, client.id));

        console.log(`✅ Updated client "${client.name}" (${client.domain}) branding`);
      } else {
        console.log(`ℹ️  Client "${client.name}" already has updated branding`);
      }
    }

    console.log('🎉 Default branding update completed successfully!');
    
  } catch (error) {
    console.error('❌ Error updating default branding:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  updateDefaultBranding()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { updateDefaultBranding };
