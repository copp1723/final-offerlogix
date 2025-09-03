#!/usr/bin/env tsx

import { dbV2 } from '../db.js';
import * as schema from '../schema/index.js';
import { eq } from 'drizzle-orm';

const { campaigns } = schema;

// SUV Templates (Master)
const SUV_BODIES = [
  `Hi [firstName],
SUVs are commanding top dollar. We're adding up to $2K in trade assist to keep them flowing.
If you've got a 2018–2022 SUV, this is the time to find out what it's really worth.
Want me to get you a number?`,

  `[FirstName],
We've had SUV owners walk in expecting one value and leave with something much higher.
Right now, we're stacking an extra $2K on qualifying trades.
Would you like me to send you your SUV's current value?`,

  `Hi [firstName],
The SUV trade assist is tied to supply. Once inventory loosens, it's gone.
If you've been thinking about moving your SUV, this is the time to act.
Want me to pull your value today?`,

  `[FirstName],
Here's the truth: SUVs are worth more right now.
We're adding up to $2K trade assist on top of normal value.
Want the real number for yours?`,

  `Hi [firstName],
If you've already traded, ignore this.
If not — the $2K trade assist is still running today.
Do you want me to send you your updated number?`,

  `[FirstName],
This is the last message on the SUV program. The $2K bonus ends once supply catches up.
If you own a 2018–2022 SUV, now's the final chance to lock in that value.
Want me to run the numbers before it's gone?`
];

const SUV_SUBJECTS = [
  "SUV trade values are at peak",
  "SUV owners are cashing in",
  "The $2K SUV bonus ends soon",
  "No hype, just SUV numbers",
  "Still holding onto your SUV?",
  "Final chance for the $2K SUV trade assist"
];

// Truck Templates (derived from SUV by replacing "SUV" with "truck")
const TRUCK_BODIES = SUV_BODIES.map(body =>
  body.replace(/SUV/g, 'truck').replace(/2018–2022/g, '2015–2022')
);

const TRUCK_SUBJECTS = SUV_SUBJECTS.map(subject =>
  subject.replace(/SUV/g, 'truck')
);

// Store signatures
const SIGNATURES = {
  'ford-eastmoline': `
---
**Kunes Ford of East Moline**
Taylor Jensen
Sales Assistant
Kunes Ford of East Moline
https://kuneseastmoline.com/
`,
  'honda-quincy': `
---
**Kunes Honda of Quincy**
Lauren Davis
Sales Assistant
Kunes Honda of Quincy
https://kuneshonda.com/
`,
  'hyundai-quincy': `
---
**Kunes Hyundai of Quincy**
Brittany Martin
Sales Assistant
Kunes Hyundai of Quincy
https://kuneshyundai.com/
`,
  'nissan-davenport': `
---
**Kunes Nissan of Davenport**
Maddie Carson
Sales Assistant
Kunes Nissan of Davenport
https://www.davenportnissan.com/
`,
  'toyota-galesburg': `
---
**Kunes Toyota of Galesburg**
Erin Hoffman
Sales Assistant
Kunes Toyota of Galesburg
https://www.kunesgalesburgtoyota.com/
`,
  'macomb': `
---
**Kunes Auto Group of Macomb**
Riley Donovan
Sales Assistant
Kunes Macomb
https://kunesmacomb.com/
`
};

// Function to get signature for campaign
function getSignatureForCampaign(name: string): string {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('ford') && lowerName.includes('eastmoline')) return SIGNATURES['ford-eastmoline'];
  if (lowerName.includes('honda') && lowerName.includes('quincy')) return SIGNATURES['honda-quincy'];
  if (lowerName.includes('hyundai') && lowerName.includes('quincy')) return SIGNATURES['hyundai-quincy'];
  if (lowerName.includes('nissan') && lowerName.includes('davenport')) return SIGNATURES['nissan-davenport'];
  if (lowerName.includes('toyota') && lowerName.includes('galesburg')) return SIGNATURES['toyota-galesburg'];
  if (lowerName.includes('macomb')) return SIGNATURES['macomb'];
  return SIGNATURES['macomb']; // Default fallback
}

// Function to determine if campaign is for trucks
function isTruckCampaign(name: string): boolean {
  return name.toLowerCase().includes('truck');
}

// Function to get templates based on campaign type
function getTemplatesForCampaign(name: string) {
  if (isTruckCampaign(name)) {
    return { bodies: TRUCK_BODIES, subjects: TRUCK_SUBJECTS };
  }
  return { bodies: SUV_BODIES, subjects: SUV_SUBJECTS };
}
function generateRandomSequence(totalDays: number = 14, steps: number = 6): number[] {
  const offsets = [0]; // Always start at day 0

  for (let i = 1; i < steps; i++) {
    // Add random days between 1-5, but ensure we don't exceed totalDays
    const remainingDays = totalDays - offsets[offsets.length - 1];
    const maxAdd = Math.min(5, remainingDays - (steps - i)); // Leave room for remaining steps
    const addDays = Math.max(1, Math.floor(Math.random() * maxAdd) + 1);
    offsets.push(offsets[offsets.length - 1] + addDays);
  }

  // Ensure last step is exactly at totalDays if possible
  if (offsets[offsets.length - 1] < totalDays) {
    offsets[offsets.length - 1] = totalDays;
  }

  return offsets;
}

// Function to set sequence for a campaign
async function setCampaignSequence(campaign: any, sequence: any[]) {
  try {
    await dbV2.update(campaigns)
      .set({ sequence })
      .where(eq(campaigns.id, campaign.id));

    console.log(`✅ Set ${isTruckCampaign(campaign.name) ? 'truck' : 'SUV'} sequence for campaign ${campaign.id} (${campaign.name}):`, sequence);
  } catch (error) {
    console.error(`❌ Failed to set sequence for campaign ${campaign.id}:`, error);
  }
}

async function main() {
  try {
    console.log('🚀 Starting sequence setup script...');
    console.log('📡 Connecting to database...');
    // Get all V2 campaigns
    const campaignList = await dbV2.select().from(campaigns);

    console.log(`Found ${campaignList.length} V2 campaigns`);

    for (const campaign of campaignList) {
      // Skip if already has a sequence
      if (campaign.sequence && campaign.sequence.length > 0) {
        console.log(`⏭️  Skipping campaign ${campaign.id} - already has sequence`);
        continue;
      }

      // Generate random sequence
      const offsets = generateRandomSequence(14, 6);
      const { bodies, subjects } = getTemplatesForCampaign(campaign.name);
      const signature = getSignatureForCampaign(campaign.name);
      const sequence = offsets.map((offset, index) => ({
        offsetDays: offset,
        subject: subjects[index] || `Follow-up ${index + 1}`,
        template: (bodies[index] || `Body ${index + 1}`) + signature
      }));

      await setCampaignSequence(campaign, sequence);
    }

    console.log('🎉 All campaigns updated with random sequences!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
}
