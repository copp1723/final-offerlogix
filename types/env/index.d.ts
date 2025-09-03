/* eslint-disable @typescript-eslint/no-unused-vars */
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: 'development' | 'production' | 'test';
    PORT?: string;
    DATABASE_URL: string;
    OPENROUTER_API_KEY?: string;
    OPENAI_API_KEY?: string;
    MAILGUN_API_KEY?: string;
    MAILGUN_DOMAIN?: string;
    MAILGUN_FROM_EMAIL?: string;
    MAILGUN_WEBHOOK_SIGNING_KEY?: string;
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_PHONE_NUMBER?: string;
    SUPERMEMORY_API_KEY?: string;
    JWT_SECRET?: string;
    JWT_ACCESS_EXPIRES_IN?: string;
    JWT_REFRESH_EXPIRES_IN?: string;
    SECURITY_ENABLED?: string;
    RATE_LIMITING_ENABLED?: string;
    API_KEY_ENCRYPTION_KEY?: string;
    ATTACK_PROTECTION_ENABLED?: string;
    LOG_LEVEL?: string;
    REDIS_URL?: string;
    SKIP_AUTH?: string;
  }
}
export {};