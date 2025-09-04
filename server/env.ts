import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(65535)).default('5000'),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Authentication
  JWT_SECRET: z.string().min(32).optional().default('default-jwt-secret-change-in-production'),
  SESSION_SECRET: z.string().optional(),
  API_KEY: z.string().min(16).optional().default('default-api-key-change-in-production'),
  SKIP_AUTH: z.string().optional().transform(val => val === 'true'),
  
  // Mailgun
  MAILGUN_API_KEY: z.string().min(1),
  MAILGUN_DOMAIN: z.string().min(1), // Using MAILGUN_DOMAIN instead of MAILGUN_DOMAIN_DEFAULT
  MAILGUN_DOMAIN_DEFAULT: z.string().optional(), // Making this optional since we use MAILGUN_DOMAIN
  MAILGUN_ALLOWED_DOMAINS: z.string().optional().default('mail.offerlogix.me'), // Making this optional with default
  MAILGUN_FROM_EMAIL: z.string().optional(),
  MAILGUN_WEBHOOK_SIGNING_KEY: z.string().optional(),
  
  // Twilio
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  
  // AI Services
  OPENROUTER_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  
  // Rate Limiting
  PREVIEW_RATE_LIMIT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).default('100'),
  SEND_RATE_LIMIT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).default('50'),
  WEBHOOK_RATE_LIMIT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).default('1000'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).default('900000'), // 15 minutes
  
  // Email Templates
  FROM_EMAIL: z.string().email().default('noreply@offerlogix.ai'),
  
  // Auto Response Control
  DISABLE_AUTO_RESPONSES: z.string().optional().transform(val => val === 'true'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // URLs
  APP_URL: z.string().url().optional(),
  CLIENT_URL: z.string().url().optional(),
  FRONTEND_URL: z.string().url().optional(),
  SITE_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().optional(),
  
  // Additional Mailgun settings
  MAILGUN_TRACKING_DOMAIN: z.string().optional(),
  INBOUND_ACCEPT_DOMAIN_SUFFIX: z.string().optional(),
  INBOUND_REQUIRE_CAMPAIGN_REPLY: z.string().optional().transform(val => val === 'true'),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

export function validateEnv(): Env {
  try {
    env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    console.error('❌ Environment validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error('  - Unknown validation error:', error);
    }
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