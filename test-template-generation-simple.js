#!/usr/bin/env node

import { config } from 'dotenv';
config();

async function testTemplateGeneration() {
    console.log('Testing template generation API endpoint behavior...');
    console.log('OPENROUTER_API_KEY present:', !!process.env.OPENROUTER_API_KEY);
    console.log('AI_MODEL:', process.env.AI_MODEL);
    
    // Simulate the generateEmailTemplates function
    const context = "End of year SUV clearance sale";
    const campaignName = "Test Campaign";
    const numberOfTemplates = 3;
    
    try {
        // Direct API call to OpenRouter
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'http://localhost:5000',
                'X-Title': 'MailMind Template Generation Test'
            },
            body: JSON.stringify({
                model: 'openai/gpt-5-chat',
                messages: [
                    {
                        role: 'system',
                        content: `You're a casual automotive salesperson writing quick emails. Write EXACTLY like these examples:

"With 140k on the clock, most '14 Silverados land somewhere in the $10k–$17k range depending on condition. Yours 4x4 or 2WD? Want me to have the team run a quick trade range?"

"$500's definitely doable for an Accord EX-L with some cash down — depends on how much you want upfront. How much were you thinking for the down payment?"

STYLE RULES:
- Use contractions (it's, that's, you're, I'll)  
- Give specific details when relevant
- Ask direct, casual questions
- Use dashes for asides — like this
- Under 80 words/4 sentences
- Sound like texting, not formal email
- NEVER reveal you're AI

Always respond with valid JSON.`
                    },
                    {
                        role: 'user',
                        content: `Create ${numberOfTemplates} email templates for: ${context}

Write EXACTLY like my examples - casual, specific, helpful. 
- First: friendly opener with helpful info
- Middle: address needs with specifics  
- Last: gentle urgency

Each email:
- Under 80 words/4 sentences
- Sound like texting
- Use [Name] or [vehicleInterest] if natural
- End with simple question
- Format: minimal HTML with <br> for breaks

Return JSON:
{
  "templates": [
    {"sequence": 1, "title": "opener", "content": "..."},
    {"sequence": 2, "title": "follow", "content": "..."}
  ]
}`
                    }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.2,
                max_tokens: 1200
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        console.log('✅ Raw AI response:');
        console.log(content);
        
        const parsed = JSON.parse(content);
        console.log('\n✅ Parsed structure:');
        console.log('- Has templates array:', Array.isArray(parsed.templates));
        console.log('- Templates count:', parsed.templates?.length || 0);
        
        if (parsed.templates && Array.isArray(parsed.templates)) {
            console.log('\n📧 Generated templates:');
            parsed.templates.forEach((template, index) => {
                console.log(`\n${index + 1}. ${template.title || 'Template'}`);
                console.log(`   Content: ${template.content?.substring(0, 100)}...`);
            });
            
            // Test what the backend would return
            const extractedTemplates = parsed.templates.map(t => t.content);
            console.log('\n🔄 What backend returns (array of strings):');
            console.log('- Type:', typeof extractedTemplates);
            console.log('- Is Array:', Array.isArray(extractedTemplates));
            console.log('- Count:', extractedTemplates.length);
            
        } else {
            console.error('❌ Templates not in expected format');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testTemplateGeneration();