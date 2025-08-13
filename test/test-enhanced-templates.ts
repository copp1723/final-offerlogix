#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();

// Direct test of the enhanced template generation
async function testEnhancedTemplates() {
  console.log('🚀 Testing Enhanced Template Generation with Automotive Tone...\n');
  
  const testData = {
    context: 'End of year clearance sale for SUVs and trucks',
    name: 'Year End Clearance',
    numberOfTemplates: 3
  };
  
  try {
    console.log('📧 Calling /api/ai/generate-templates endpoint...\n');
    
    const response = await fetch('http://localhost:5050/api/ai/generate-templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    
    if (result.templates && Array.isArray(result.templates)) {
      console.log(`✅ Generated ${result.templates.length} templates\n`);
      
      result.templates.forEach((template: string, index: number) => {
        console.log(`📧 Template ${index + 1}:`);
        console.log('─'.repeat(50));
        
        // Strip HTML tags for word count
        const plainText = template.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const wordCount = plainText.split(' ').length;
        const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        
        console.log(`📊 Stats: ${wordCount} words, ${sentences} sentences`);
        
        if (wordCount > 80) {
          console.log('⚠️  WARNING: Exceeds 80-word limit!');
        }
        if (sentences > 4) {
          console.log('⚠️  WARNING: Exceeds 4-sentence limit!');
        }
        
        // Show first 200 chars of content
        console.log(`\nContent Preview:`);
        console.log(template.substring(0, 200) + (template.length > 200 ? '...' : ''));
        console.log('\n');
      });
      
      // Check for key elements
      console.log('🔍 Checking for Enhanced Tone Elements:');
      const checks = {
        'Human persona (no AI mentions)': !result.templates.some((t: string) => /\bAI\b|\bautomated\b|\bdigital assistant\b/i.test(t)),
        'Personalization placeholders': result.templates.some((t: string) => /\[Name\]|\[vehicleInterest\]/i.test(t)),
        'Emotional connection': result.templates.some((t: string) => /feel|excited|trust|understand|care/i.test(t)),
        'Clear next steps': result.templates.some((t: string) => /call|visit|stop by|let's|come in|schedule/i.test(t)),
        'Conversational tone': result.templates.some((t: string) => /I'm|we're|you'll|let's/i.test(t)),
        '80-word constraint': result.templates.every((t: string) => {
          const plain = t.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          return plain.split(' ').length <= 80;
        })
      };
      
      Object.entries(checks).forEach(([check, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${check}`);
      });
      
    } else {
      console.log('❌ No templates generated or invalid response format');
      console.log('Response:', result);
    }
    
  } catch (error) {
    console.error('❌ Error testing templates:', error);
  }
}

testEnhancedTemplates();