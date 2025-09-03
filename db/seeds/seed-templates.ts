#!/usr/bin/env tsx

import { randomUUID } from 'crypto';
import { db } from '../../server/db';
import { campaigns, templates } from '../../shared/schema';

async function seed() {
  console.log('Seeding templates...');
  
  try {
    const campaignId = randomUUID();
    
    // Create a sample campaign
    await db.insert(campaigns).values({
      id: campaignId,
      name: 'Sample Campaign',
      context: 'Sample campaign context for automotive dealership',
      status: 'active',
      templates: [],
      subjectLines: [],
      numberOfTemplates: 2,
      daysBetweenMessages: 1,
      communicationType: 'email',
      scheduleType: 'immediate',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Create sample templates
    await db.insert(templates).values([
      {
        campaignId,
        subject: 'Welcome to our dealership',
        html: '<p>Hello {{firstName}}, check out our latest offers!</p>',
        text: 'Hello {{firstName}}, check out our latest offers!',
        variables: { firstName: 'string' },
        version: 1
      },
      {
        campaignId,
        subject: 'Exclusive deal for {{persona}} buyers',
        html: '<p>Hi {{persona}}, we have a special deal just for you.</p>',
        text: 'Hi {{persona}}, we have a special deal just for you.',
        variables: { persona: 'string' },
        version: 1
      }
    ]);

    console.log('✅ Seeded sample campaign with templates');
  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (require.main === module) {
  seed().then(() => {
    console.log('Seeding completed successfully');
    process.exit(0);
  }).catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
}

export { seed };