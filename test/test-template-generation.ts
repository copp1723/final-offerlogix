#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();

import { LLMClient } from '../server/services/llm-client';

async function testTemplateGeneration() {
  console.log('Testing template generation...');
  console.log('API Key present:', !!process.env.OPENROUTER_API_KEY);
  
  const templatePrompt = `
Create 3 automotive email templates for this campaign:
Context: End of year clearance sale for all SUVs and trucks
Goals: Drive showroom visits and increase test drives
Handover Criteria: Customer asks about pricing, financing, or wants to schedule a visit

Each template should:
- Be automotive industry focused
- Include personalization placeholders like [Name] and [vehicleInterest]
- Progress from introduction to call-to-action
- Be professional but engaging
- Include automotive-specific offers or information

Return JSON array of template objects with "subject" and "content" fields.`;

  try {
    console.log('\n📧 Generating templates...');
    const response = await LLMClient.generateAutomotiveContent(templatePrompt);
    console.log('\n✅ Raw response:', response.content);
    
    const templates = JSON.parse(response.content);
    console.log('\n✅ Parsed templates:');
    templates.forEach((t: any, i: number) => {
      console.log(`\n📧 Template ${i + 1}:`);
      console.log(`Subject: ${t.subject}`);
      console.log(`Content: ${t.content.substring(0, 100)}...`);
    });
    
  } catch (error) {
    console.error('❌ Error generating templates:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

testTemplateGeneration();