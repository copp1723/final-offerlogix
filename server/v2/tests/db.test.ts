/**
 * Database schema and seed data tests
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  agents, 
  systemPrompts, 
  campaigns, 
  leads, 
  conversations, 
  messages,
  type Agent,
  type SystemPrompt 
} from '../schema';
import { eq, and } from 'drizzle-orm';

// Test database connection
const testDb = drizzle(postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432/mailmind_test'));

describe('MailMind V2 Database Schema', () => {
  
  describe('Schema Structure', () => {
    
    test('should have all required tables', async () => {
      // Test table existence by attempting simple queries
      const [promptCount] = await testDb.select().from(systemPrompts).limit(1);
      const [agentCount] = await testDb.select().from(agents).limit(1);
      const [campaignCount] = await testDb.select().from(campaigns).limit(1);
      const [leadCount] = await testDb.select().from(leads).limit(1);
      const [conversationCount] = await testDb.select().from(conversations).limit(1);
      const [messageCount] = await testDb.select().from(messages).limit(1);
      
      // If queries don't throw, tables exist
      expect(true).toBe(true);
    });

    test('should enforce unique constraints', async () => {
      // Test agent domain uniqueness
      const testPrompt = await testDb.insert(systemPrompts).values({
        name: 'Test Prompt',
        prompt: 'Test {{role}}',
        version: 1,
        isGlobal: true,
      }).returning();

      const firstAgent = await testDb.insert(agents).values({
        clientId: 'test-client',
        name: 'Test Agent',
        domain: 'test.example.com',
        localPart: 'test',
        systemPromptId: testPrompt[0].id,
        variables: { role: 'Tester', dealership: 'Test Co', handoverTriggers: 'Never' },
        isActive: true,
      }).returning();

      // Attempt duplicate domain for same client should fail
      await expect(
        testDb.insert(agents).values({
          clientId: 'test-client',
          name: 'Another Agent',
          domain: 'test.example.com', // Same domain
          localPart: 'another',
          systemPromptId: testPrompt[0].id,
          variables: { role: 'Another', dealership: 'Test Co', handoverTriggers: 'Never' },
          isActive: true,
        })
      ).rejects.toThrow();

      // Cleanup
      await testDb.delete(agents).where(eq(agents.id, firstAgent[0].id));
      await testDb.delete(systemPrompts).where(eq(systemPrompts.id, testPrompt[0].id));
    });

    test('should validate email formats in leads', async () => {
      // Create test data
      const testPrompt = await testDb.insert(systemPrompts).values({
        name: 'Test Prompt',
        prompt: 'Test {{role}}',
        version: 1,
        isGlobal: true,
      }).returning();

      const testAgent = await testDb.insert(agents).values({
        clientId: 'test-client',
        name: 'Test Agent',
        domain: 'test.example.com',
        localPart: 'test',
        systemPromptId: testPrompt[0].id,
        variables: { role: 'Tester', dealership: 'Test Co', handoverTriggers: 'Never' },
        isActive: true,
      }).returning();

      const testCampaign = await testDb.insert(campaigns).values({
        agentId: testAgent[0].id,
        name: 'Test Campaign',
        template: 'Hello {{name}}',
        subject: 'Test Email',
        status: 'draft',
      }).returning();

      // Valid email should work
      const validLead = await testDb.insert(leads).values({
        email: 'valid@example.com',
        campaignId: testCampaign[0].id,
        agentId: testAgent[0].id,
        status: 'active',
      }).returning();

      expect(validLead[0]).toBeTruthy();

      // Invalid email should fail
      await expect(
        testDb.insert(leads).values({
          email: 'invalid-email', // Bad format
          campaignId: testCampaign[0].id,
          agentId: testAgent[0].id,
          status: 'active',
        })
      ).rejects.toThrow();

      // Cleanup
      await testDb.delete(leads).where(eq(leads.id, validLead[0].id));
      await testDb.delete(campaigns).where(eq(campaigns.id, testCampaign[0].id));
      await testDb.delete(agents).where(eq(agents.id, testAgent[0].id));
      await testDb.delete(systemPrompts).where(eq(systemPrompts.id, testPrompt[0].id));
    });

  });

  describe('Seed Data', () => {
    
    test('should have global system prompt', async () => {
      const globalPrompts = await testDb
        .select()
        .from(systemPrompts)
        .where(and(
          eq(systemPrompts.name, 'Automotive Sales V1'),
          eq(systemPrompts.isGlobal, true)
        ));

      expect(globalPrompts).toHaveLength(1);
      expect(globalPrompts[0].prompt).toContain('{{role}}');
      expect(globalPrompts[0].prompt).toContain('{{dealership}}');
      expect(globalPrompts[0].prompt).toContain('{{handoverTriggers}}');
    });

    test('should have Riley Donovan demo agent', async () => {
      const rileyAgent = await testDb
        .select()
        .from(agents)
        .where(and(
          eq(agents.name, 'Riley Donovan'),
          eq(agents.domain, 'kunesmacomb.kunesauto.vip'),
          eq(agents.localPart, 'riley')
        ));

      expect(rileyAgent).toHaveLength(1);
      expect(rileyAgent[0].clientId).toBe('demo-client');
      expect(rileyAgent[0].isActive).toBe(true);
      
      const variables = rileyAgent[0].variables as any;
      expect(variables.role).toBe('Sales Representative');
      expect(variables.dealership).toBe('Kunes Macomb');
      expect(variables.handoverTriggers).toContain('specialist');
    });

    test('should link agent to global prompt', async () => {
      const agentWithPrompt = await testDb
        .select({
          agent: agents,
          prompt: systemPrompts
        })
        .from(agents)
        .innerJoin(systemPrompts, eq(agents.systemPromptId, systemPrompts.id))
        .where(eq(agents.name, 'Riley Donovan'));

      expect(agentWithPrompt).toHaveLength(1);
      expect(agentWithPrompt[0].prompt.name).toBe('Automotive Sales V1');
      expect(agentWithPrompt[0].agent.name).toBe('Riley Donovan');
    });

  });

  describe('Indexes', () => {
    
    test('should support efficient conversation routing lookups', async () => {
      // Create test conversation
      const testPrompt = await testDb.insert(systemPrompts).values({
        name: 'Test Prompt',
        prompt: 'Test {{role}}',
        version: 1,
        isGlobal: true,
      }).returning();

      const testAgent = await testDb.insert(agents).values({
        clientId: 'test-client',
        name: 'Test Agent',
        domain: 'test.example.com',
        localPart: 'test',
        systemPromptId: testPrompt[0].id,
        variables: { role: 'Tester', dealership: 'Test Co', handoverTriggers: 'Never' },
        isActive: true,
      }).returning();

      const testConversation = await testDb.insert(conversations).values({
        agentId: testAgent[0].id,
        leadEmail: 'test@example.com',
        threadId: 'thread-123',
        subject: 'Test Conversation',
        status: 'active',
      }).returning();

      // Query using the routing index
      const foundConversations = await testDb
        .select()
        .from(conversations)
        .where(and(
          eq(conversations.agentId, testAgent[0].id),
          eq(conversations.leadEmail, 'test@example.com')
        ));

      expect(foundConversations).toHaveLength(1);
      expect(foundConversations[0].id).toBe(testConversation[0].id);

      // Cleanup
      await testDb.delete(conversations).where(eq(conversations.id, testConversation[0].id));
      await testDb.delete(agents).where(eq(agents.id, testAgent[0].id));
      await testDb.delete(systemPrompts).where(eq(systemPrompts.id, testPrompt[0].id));
    });

    test('should support chronological message retrieval', async () => {
      // Create test data
      const testPrompt = await testDb.insert(systemPrompts).values({
        name: 'Test Prompt',
        prompt: 'Test {{role}}',
      }).returning();

      const testAgent = await testDb.insert(agents).values({
        clientId: 'test-client',
        name: 'Test Agent',
        domain: 'test.example.com',
        localPart: 'test',
        systemPromptId: testPrompt[0].id,
        variables: { role: 'Tester', dealership: 'Test Co', handoverTriggers: 'Never' },
      }).returning();

      const testConversation = await testDb.insert(conversations).values({
        agentId: testAgent[0].id,
        leadEmail: 'test@example.com',
        threadId: 'thread-123',
        subject: 'Test Conversation',
      }).returning();

      // Insert messages with different timestamps
      const message1 = await testDb.insert(messages).values({
        conversationId: testConversation[0].id,
        content: 'First message',
        sender: 'lead',
        messageId: 'msg-1@example.com',
      }).returning();

      const message2 = await testDb.insert(messages).values({
        conversationId: testConversation[0].id,
        content: 'Second message',
        sender: 'agent',
        messageId: 'msg-2@example.com',
        inReplyTo: 'msg-1@example.com',
      }).returning();

      // Query messages chronologically
      const chronologicalMessages = await testDb
        .select()
        .from(messages)
        .where(eq(messages.conversationId, testConversation[0].id))
        .orderBy(messages.createdAt);

      expect(chronologicalMessages).toHaveLength(2);
      expect(chronologicalMessages[0].content).toBe('First message');
      expect(chronologicalMessages[1].content).toBe('Second message');
      expect(chronologicalMessages[1].inReplyTo).toBe('msg-1@example.com');

      // Cleanup
      await testDb.delete(messages).where(eq(messages.conversationId, testConversation[0].id));
      await testDb.delete(conversations).where(eq(conversations.id, testConversation[0].id));
      await testDb.delete(agents).where(eq(agents.id, testAgent[0].id));
      await testDb.delete(systemPrompts).where(eq(systemPrompts.id, testPrompt[0].id));
    });

  });

});