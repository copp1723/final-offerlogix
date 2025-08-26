import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(65535)).default('5050'),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Application URLs
  APP_URL: z.string().url(),
  CLIENT_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  SITE_URL: z.string().url(),
  CORS_ORIGIN: z.string().url(),
  
  // Authentication & Security
  SESSION_SECRET: z.string().min(32),
  
  // Mailgun Configuration
  MAILGUN_API_KEY: z.string().min(1),
  MAILGUN_DOMAIN: z.string().min(1),
  MAILGUN_FROM_EMAIL: z.string().min(1), // Allowing custom format like "Brittany <brittany@mail.offerlogix.me>"
  MAILGUN_TRACKING_DOMAIN: z.string().min(1),
  MAILGUN_WEBHOOK_SIGNING_KEY: z.string().min(1),
  
  // AI Services
  OPENROUTER_API_KEY: z.string().min(1),
  
  // Inbound Email Configuration
  INBOUND_ACCEPT_DOMAIN_SUFFIX: z.string().min(1),
  INBOUND_REQUIRE_CAMPAIGN_REPLY: z.string().transform(val => val === 'true').default('true'),
  
  // Optional Environment Variables with Defaults
  SUPERMEMORY_API_KEY: z.string().optional(),
  SUPERMEMORY_BASE_URL: z.string().url().optional(),
  SUPERMEMORY_RAG: z.string().optional(),
  
  // Rate Limiting (for the components we'll add)
  AI_CONVERSATION_COOLDOWN_MS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).default('300000'), // 5 minutes
  CAMPAIGN_RATE_LIMIT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).default('10'),
  WEBHOOK_RATE_LIMIT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).default('100'),
  
  // Database Connection Pool
  DATABASE_POOL_MAX: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).default('20'),
  DATABASE_POOL_MIN: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).default('5'),
  DATABASE_IDLE_TIMEOUT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).default('30000'),
  DATABASE_CONNECTION_TIMEOUT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).default('10000'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

export function validateEnv(): Env {
  try {
    env = envSchema.parse(process.env);
    console.log('✅ Environment validation successful');
    return env;
  } catch (error) {
    console.error('❌ Environment validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      console.error('\n📋 Required environment variables:');
      console.error('  - DATABASE_URL: PostgreSQL connection string');
      console.error('  - APP_URL, CLIENT_URL, FRONTEND_URL, SITE_URL, CORS_ORIGIN: Application URLs');
      console.error('  - SESSION_SECRET: Random string (32+ characters)');
      console.error('  - MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_FROM_EMAIL: Mailgun configuration');
      console.error('  - MAILGUN_TRACKING_DOMAIN, MAILGUN_WEBHOOK_SIGNING_KEY: Mailgun settings');
      console.error('  - OPENROUTER_API_KEY: AI service key');
      console.error('  - INBOUND_ACCEPT_DOMAIN_SUFFIX: Domain for inbound emails');
      console.error('  - INBOUND_REQUIRE_CAMPAIGN_REPLY: true/false');
    } else {
      console.error('  - Unknown validation error:', error);
    }
    console.error('\n🔧 Fix these issues and restart the server.');
    process.exit(1);
  }
}

export function getEnv(): Env {
  if (!env) {
    env = validateEnv();
  }
  return env;
}

// Validate environment variables on module load in production
if (process.env.NODE_ENV === 'production') {
  validateEnv();
}