import { makeApp } from './appFactory';
import { seedCampaignWithRecipients, getCampaignStatus } from '../utils/seed';
import { signMailgun } from '../utils/mailgun';
import fs from 'node:fs/promises';

// Simple in-memory queue for tests
class MemoryQueue {
  private data: any[] = [];
  add(item: any) {
    this.data.push(item);
  }
  items() {
    return this.data;
  }
  clear() {
    this.data = [];
  }
}

export const queue = new MemoryQueue();

export const testDb = {
  seedCampaignWithRecipients,
  getCampaignStatus,
  mailgun: {
    sign: (payload: any, ts?: string) =>
      signMailgun(payload, ts || Math.floor(Date.now() / 1000).toString(), process.env.MAILGUN_SIGNING_KEY || 'test_key'),
  },
};

export async function saveArtifact(name: string, content: string) {
  try {
    await fs.mkdir('artifacts', { recursive: true });
    await fs.writeFile(`artifacts/${name}`, content);
    console.log(`Saved artifact: artifacts/${name}`);
  } catch (error) {
    console.warn(`Failed to save artifact ${name}:`, error);
  }
}

export { makeApp };