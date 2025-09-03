#!/usr/bin/env ts-node

/**
 * Generate Fixtures - Development Script
 * 
 * Generates new test fixtures with proper signatures and deterministic data.
 * Useful for creating new test scenarios during development.
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { signFixturePayload, TEST_SIGNING_KEY } from '../tests/helpers/mailgun-signer';

// ============================================================================
// FIXTURE TEMPLATES
// ============================================================================

interface FixtureTemplate {
  description: string;
  scenario: string;
  mailgun_payload: any;
  expected_normalized: any;
}

const FIXTURE_TEMPLATES: Record<string, FixtureTemplate> = {
  'basic-reply': {
    description: 'Basic customer reply to agent',
    scenario: 'basic-reply',
    mailgun_payload: {
      'message-id': '<basic-reply-msg@customer.example.com>',
      from: 'Customer Name <customer@example.com>',
      to: 'Agent Name <agent@company.example.com>',
      subject: 'Basic Reply Subject',
      'body-plain': 'This is a basic reply message.',
      'body-html': '<p>This is a basic reply message.</p>',
    },
    expected_normalized: {
      agentLocalPart: 'agent',
      agentDomain: 'company.example.com',
      fromEmail: 'customer@example.com',
      subject: 'Basic Reply Subject',
      messageId: '<basic-reply-msg@customer.example.com>',
      inReplyTo: null,
    },
  },
  
  'threaded-reply': {
    description: 'Threaded reply with In-Reply-To and References',
    scenario: 'threaded-reply',
    mailgun_payload: {
      'message-id': '<threaded-reply-msg@customer.example.com>',
      from: 'Customer Name <customer@example.com>',
      to: 'Agent Name <agent@company.example.com>',
      subject: 'Re: Threaded Reply Subject',
      'in-reply-to': '<agent-msg@company.example.com>',
      references: '<initial-msg@customer.example.com> <agent-msg@company.example.com>',
      'body-plain': 'This is a threaded reply message.',
      'body-html': '<p>This is a threaded reply message.</p>',
    },
    expected_normalized: {
      agentLocalPart: 'agent',
      agentDomain: 'company.example.com',
      fromEmail: 'customer@example.com',
      subject: 'Re: Threaded Reply Subject',
      messageId: '<threaded-reply-msg@customer.example.com>',
      inReplyTo: '<agent-msg@company.example.com>',
      references: [
        '<initial-msg@customer.example.com>',
        '<agent-msg@company.example.com>'
      ],
    },
  },
};

// ============================================================================
// FIXTURE GENERATION
// ============================================================================

function generateFixture(
  templateName: string,
  customizations: Partial<FixtureTemplate> = {},
  signingKey: string = TEST_SIGNING_KEY
): any {
  const template = FIXTURE_TEMPLATES[templateName];
  if (!template) {
    throw new Error(`Unknown template: ${templateName}`);
  }
  
  // Merge template with customizations
  const fixture = {
    ...template,
    ...customizations,
    mailgun_payload: {
      ...template.mailgun_payload,
      ...customizations.mailgun_payload,
    },
    expected_normalized: {
      ...template.expected_normalized,
      ...customizations.expected_normalized,
    },
  };
  
  // Add timestamp and signature
  fixture.timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Sign the fixture
  return signFixturePayload(fixture, signingKey);
}

function saveFixture(fixture: any, filename: string): void {
  const fixturesDir = join(__dirname, '../tests/fixtures/mailgun');
  const filepath = join(fixturesDir, filename);
  
  writeFileSync(filepath, JSON.stringify(fixture, null, 2));
  console.log(`✅ Saved fixture: ${filepath}`);
}

// ============================================================================
// BATCH GENERATION
// ============================================================================

function generateAllTemplates(signingKey: string = TEST_SIGNING_KEY): void {
  console.log('🏭 Generating all fixture templates...\n');
  
  for (const [templateName, template] of Object.entries(FIXTURE_TEMPLATES)) {
    try {
      const fixture = generateFixture(templateName, {}, signingKey);
      const filename = `${templateName}.json`;
      saveFixture(fixture, filename);
    } catch (error) {
      console.error(`❌ Failed to generate ${templateName}:`, error);
    }
  }
  
  console.log('\n🎉 All fixtures generated successfully!');
}

// ============================================================================
// CUSTOM FIXTURE GENERATION
// ============================================================================

function generateCustomFixture(options: {
  templateName: string;
  scenario: string;
  agentDomain: string;
  agentLocalPart: string;
  customerEmail: string;
  subject: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  content?: string;
  signingKey?: string;
}): any {
  const {
    templateName,
    scenario,
    agentDomain,
    agentLocalPart,
    customerEmail,
    subject,
    messageId,
    inReplyTo,
    references,
    content,
    signingKey = TEST_SIGNING_KEY,
  } = options;
  
  const customizations: Partial<FixtureTemplate> = {
    scenario,
    mailgun_payload: {
      'message-id': messageId || `<custom-${Date.now()}@${customerEmail.split('@')[1]}>`,
      from: `Customer <${customerEmail}>`,
      to: `Agent <${agentLocalPart}@${agentDomain}>`,
      subject,
      'body-plain': content || 'Custom fixture content.',
      'body-html': `<p>${content || 'Custom fixture content.'}</p>`,
    },
    expected_normalized: {
      agentLocalPart,
      agentDomain,
      fromEmail: customerEmail,
      subject,
      messageId: messageId || `<custom-${Date.now()}@${customerEmail.split('@')[1]}>`,
      inReplyTo: inReplyTo || null,
      references: references || undefined,
    },
  };
  
  if (inReplyTo) {
    customizations.mailgun_payload!['in-reply-to'] = inReplyTo;
  }
  
  if (references && references.length > 0) {
    customizations.mailgun_payload!.references = references.join(' ');
  }
  
  return generateFixture(templateName, customizations, signingKey);
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

function printUsage() {
  console.log(`
Usage: npx ts-node v2/dev/generate-fixtures.ts [command] [options]

Commands:
  all                    Generate all template fixtures
  custom                 Generate a custom fixture
  list                   List available templates

Options for 'custom' command:
  --template <name>      Base template to use (required)
  --scenario <name>      Scenario name (required)
  --agent-domain <domain>     Agent domain (required)
  --agent-local-part <part>   Agent local part (required)
  --customer-email <email>    Customer email (required)
  --subject <subject>         Email subject (required)
  --message-id <id>           Custom message ID (optional)
  --in-reply-to <id>          In-Reply-To header (optional)
  --references <ids>          References (comma-separated, optional)
  --content <text>            Email content (optional)
  --signing-key <key>         Signing key (optional)
  --output <filename>         Output filename (optional)

Available templates:
  - basic-reply          Basic customer reply
  - threaded-reply       Reply with threading headers

Examples:
  # Generate all templates
  npx ts-node v2/dev/generate-fixtures.ts all

  # Generate custom fixture
  npx ts-node v2/dev/generate-fixtures.ts custom \\
    --template basic-reply \\
    --scenario test-scenario \\
    --agent-domain test.com \\
    --agent-local-part testbot \\
    --customer-email customer@example.com \\
    --subject "Test Subject"
`);
}

function parseArgs(): { command: string; options: any } {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(0);
  }
  
  const command = args[0];
  const options: any = {};
  
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--template':
        options.templateName = args[++i];
        break;
      case '--scenario':
        options.scenario = args[++i];
        break;
      case '--agent-domain':
        options.agentDomain = args[++i];
        break;
      case '--agent-local-part':
        options.agentLocalPart = args[++i];
        break;
      case '--customer-email':
        options.customerEmail = args[++i];
        break;
      case '--subject':
        options.subject = args[++i];
        break;
      case '--message-id':
        options.messageId = args[++i];
        break;
      case '--in-reply-to':
        options.inReplyTo = args[++i];
        break;
      case '--references':
        options.references = args[++i].split(',').map(s => s.trim());
        break;
      case '--content':
        options.content = args[++i];
        break;
      case '--signing-key':
        options.signingKey = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
    }
  }
  
  return { command, options };
}

// Run the script if called directly
if (require.main === module) {
  const { command, options } = parseArgs();
  
  try {
    switch (command) {
      case 'all':
        generateAllTemplates(options.signingKey);
        break;
        
      case 'custom':
        if (!options.templateName || !options.scenario || !options.agentDomain || 
            !options.agentLocalPart || !options.customerEmail || !options.subject) {
          console.error('Missing required options for custom fixture');
          printUsage();
          process.exit(1);
        }
        
        const fixture = generateCustomFixture(options);
        const filename = options.output || `${options.scenario}.json`;
        saveFixture(fixture, filename);
        break;
        
      case 'list':
        console.log('Available templates:');
        for (const [name, template] of Object.entries(FIXTURE_TEMPLATES)) {
          console.log(`  ${name}: ${template.description}`);
        }
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

export { generateFixture, generateCustomFixture, generateAllTemplates };
