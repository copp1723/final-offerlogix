#!/usr/bin/env node

/**
 * Supermemory Setup Script
 * 
 * This script helps configure Supermemory integration for MailMind.
 * It validates the API key and tests the connection.
 */

import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function testSupermemoryConnection(apiKey, baseUrl = 'https://api.supermemory.ai') {
  try {
    console.log('🔍 Testing Supermemory connection...');
    
    const response = await fetch(`${baseUrl}/v1/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      console.log('✅ Supermemory connection successful!');
      return true;
    } else {
      console.log(`❌ Connection failed: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Connection error: ${error.message}`);
    return false;
  }
}

async function updateEnvFile(apiKey, baseUrl) {
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  try {
    envContent = fs.readFileSync(envPath, 'utf8');
  } catch (error) {
    console.log('⚠️  .env file not found, creating new one...');
  }

  // Update or add Supermemory configuration
  const updates = {
    'SUPERMEMORY_API_KEY': apiKey,
    'SUPERMEMORY_BASE_URL': baseUrl,
    'SUPERMEMORY_RAG': 'on',
    'SUPERMEMORY_TIMEOUT_MS': '8000',
    'SUPERMEMORY_MAX_RETRIES': '3'
  };

  let updatedContent = envContent;
  
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}=${value}`;
    
    if (regex.test(updatedContent)) {
      updatedContent = updatedContent.replace(regex, line);
    } else {
      updatedContent += `\n${line}`;
    }
  }

  fs.writeFileSync(envPath, updatedContent);
  console.log('✅ .env file updated with Supermemory configuration');
}

async function main() {
  console.log('🚀 MailMind Supermemory Setup');
  console.log('================================\n');

  // Check if already configured
  const existingKey = process.env.SUPERMEMORY_API_KEY;
  if (existingKey && existingKey !== 'your-supermemory-api-key-here') {
    console.log('🔍 Existing Supermemory configuration found.');
    const useExisting = await question('Test existing configuration? (y/n): ');
    
    if (useExisting.toLowerCase() === 'y') {
      const success = await testSupermemoryConnection(existingKey, process.env.SUPERMEMORY_BASE_URL);
      if (success) {
        console.log('✅ Existing configuration is working correctly!');
        rl.close();
        return;
      }
    }
  }

  console.log('\n📝 Supermemory Configuration');
  console.log('To get your API key:');
  console.log('1. Visit https://supermemory.ai');
  console.log('2. Sign up or log in to your account');
  console.log('3. Navigate to API settings');
  console.log('4. Generate a new API key\n');

  const apiKey = await question('Enter your Supermemory API key: ');
  
  if (!apiKey || apiKey.trim() === '') {
    console.log('❌ API key is required. Exiting...');
    rl.close();
    return;
  }

  const baseUrl = await question('Enter Supermemory base URL (press Enter for default): ') || 'https://api.supermemory.ai';

  // Test the connection
  const success = await testSupermemoryConnection(apiKey.trim(), baseUrl.trim());
  
  if (success) {
    await updateEnvFile(apiKey.trim(), baseUrl.trim());
    console.log('\n🎉 Supermemory setup complete!');
    console.log('📋 Features now enabled:');
    console.log('  • Campaign memory and context');
    console.log('  • Lead conversation history');
    console.log('  • AI-powered insights');
    console.log('  • Smart campaign optimization');
    console.log('\n🔄 Please restart your MailMind server to apply changes.');
  } else {
    console.log('\n❌ Setup failed. Please check your API key and try again.');
  }

  rl.close();
}

main().catch(console.error);
