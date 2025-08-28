#!/usr/bin/env node

/**
 * VALIDATION SCRIPT
 * Run this AFTER applying all fixes to verify everything is correct
 */

const fs = require('fs');
const path = require('path');

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function checkFile(filePath, fileName) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, fileName };
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  return { exists: true, content, fileName };
}

function validateFix() {
  console.log(`${BOLD}🔍 VALIDATING OFFERLOGIX EMAIL FIXES${RESET}\n`);
  
  const baseDir = '/Users/joshcopp/Desktop/Swarm/OFFERLOGIX';
  let allPassed = true;
  const issues = [];
  
  // Check 1: Threading helper exists
  console.log('1. Checking threading helper...');
  const threadingHelper = checkFile(
    path.join(baseDir, 'server/utils/threading-helper.ts'),
    'threading-helper.ts'
  );
  
  if (threadingHelper.exists) {
    console.log(`   ${GREEN}✅ threading-helper.ts exists${RESET}`);
    
    // Check for key functions
    if (threadingHelper.content.includes('extractMessageId') && 
        threadingHelper.content.includes('buildThreadingHeaders')) {
      console.log(`   ${GREEN}✅ Contains required functions${RESET}`);
    } else {
      console.log(`   ${RED}❌ Missing required functions${RESET}`);
      issues.push('threading-helper.ts missing required functions');
      allPassed = false;
    }
  } else {
    console.log(`   ${RED}❌ threading-helper.ts not found${RESET}`);
    issues.push('threading-helper.ts not created');
    allPassed = false;
  }
  
  // Check 2: mailgun-threaded.ts fixes
  console.log('\n2. Checking mailgun-threaded.ts...');
  const threadedFile = checkFile(
    path.join(baseDir, 'server/services/mailgun-threaded.ts'),
    'mailgun-threaded.ts'
  );
  
  if (threadedFile.exists) {
    console.log(`   ${GREEN}✅ File exists${RESET}`);
    
    // Check for plus-addressing removal
    if (threadedFile.content.includes('brittany+conv_')) {
      console.log(`   ${RED}❌ Still contains plus-addressing (brittany+conv_)${RESET}`);
      issues.push('Plus-addressing not removed from mailgun-threaded.ts');
      allPassed = false;
    } else {
      console.log(`   ${GREEN}✅ Plus-addressing removed${RESET}`);
    }
    
    // Check for clean sender
    if (threadedFile.content.includes('Brittany <brittany@')) {
      console.log(`   ${GREEN}✅ Clean sender format found${RESET}`);
    } else {
      console.log(`   ${YELLOW}⚠️  Clean sender format not found - verify manually${RESET}`);
    }
    
    // Check for threading support
    if (threadedFile.content.includes('inReplyTo') && threadedFile.content.includes('references')) {
      console.log(`   ${GREEN}✅ Threading headers supported${RESET}`);
    } else {
      console.log(`   ${RED}❌ Missing threading header support${RESET}`);
      issues.push('Threading headers not properly configured');
      allPassed = false;
    }
  } else {
    console.log(`   ${RED}❌ File not found${RESET}`);
    issues.push('mailgun-threaded.ts not found');
    allPassed = false;
  }
  
  // Check 3: inbound-email.ts updates
  console.log('\n3. Checking inbound-email.ts...');
  const inboundFile = checkFile(
    path.join(baseDir, 'server/services/inbound-email.ts'),
    'inbound-email.ts'
  );
  
  if (inboundFile.exists) {
    console.log(`   ${GREEN}✅ File exists${RESET}`);
    
    // Check for import
    if (inboundFile.content.includes("import { extractMessageId, buildThreadingHeaders } from '../utils/threading-helper'")) {
      console.log(`   ${GREEN}✅ Threading helper imported${RESET}`);
    } else {
      console.log(`   ${YELLOW}⚠️  Threading helper import not found - needs manual update${RESET}`);
      issues.push('Need to add threading helper import to inbound-email.ts');
    }
    
    // Check for old Message-ID extraction
    if (inboundFile.content.includes('// Simplified Message-ID extraction for threading')) {
      console.log(`   ${YELLOW}⚠️  Old Message-ID extraction still present - needs manual update${RESET}`);
      issues.push('Need to replace Message-ID extraction in inbound-email.ts');
    } else if (inboundFile.content.includes('extractMessageId(event)')) {
      console.log(`   ${GREEN}✅ Using new Message-ID extraction${RESET}`);
    }
    
    // Check for buildThreadingHeaders usage
    if (inboundFile.content.includes('buildThreadingHeaders(')) {
      console.log(`   ${GREEN}✅ Using buildThreadingHeaders function${RESET}`);
    } else {
      console.log(`   ${YELLOW}⚠️  Not using buildThreadingHeaders - needs manual update${RESET}`);
      issues.push('Need to use buildThreadingHeaders in inbound-email.ts');
    }
  } else {
    console.log(`   ${RED}❌ File not found${RESET}`);
    issues.push('inbound-email.ts not found');
    allPassed = false;
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  
  if (allPassed && issues.length === 0) {
    console.log(`\n${GREEN}${BOLD}✅ ALL VALIDATIONS PASSED!${RESET}\n`);
    console.log('Your email system should now:');
    console.log('  • Send from: Brittany <brittany@mail.offerlogix.me>');
    console.log('  • NOT show plus-addressing to customers');
    console.log('  • Keep replies in the same email thread');
    console.log('  • Extract Message-IDs reliably');
    
    console.log(`\n${BOLD}Ready to test:${RESET}`);
    console.log('  1. npm run build');
    console.log('  2. npm start');
    console.log('  3. Send a test email and reply to verify threading');
    
  } else if (issues.length > 0) {
    console.log(`\n${YELLOW}${BOLD}⚠️  MANUAL UPDATES NEEDED:${RESET}\n`);
    
    issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
    
    console.log(`\n${BOLD}To complete the fix:${RESET}`);
    console.log('  1. Review inbound-email-changes.txt for exact changes needed');
    console.log('  2. Update server/services/inbound-email.ts manually');
    console.log('  3. Run this validation again to confirm');
    console.log('  4. npm run build && npm start');
    
  } else {
    console.log(`\n${RED}${BOLD}❌ CRITICAL ISSUES FOUND${RESET}\n`);
    console.log('Please run the fix script first:');
    console.log('  node fix-threading-keep-brittany.js');
  }
  
  // Check for backup files
  console.log(`\n${BOLD}Backup files:${RESET}`);
  const backupPattern = /\.(backup|bak)\./;
  const files = fs.readdirSync(path.join(baseDir, 'server/services'));
  const backups = files.filter(f => backupPattern.test(f));
  
  if (backups.length > 0) {
    console.log(`  Found ${backups.length} backup file(s):`);
    backups.slice(0, 3).forEach(b => console.log(`    • ${b}`));
    if (backups.length > 3) {
      console.log(`    ... and ${backups.length - 3} more`);
    }
  } else {
    console.log('  No backup files found (originals may not have been backed up)');
  }
}

// Run validation
try {
  validateFix();
} catch (error) {
  console.error(`\n${RED}${BOLD}Validation failed with error:${RESET}`);
  console.error(error);
  process.exit(1);
}
