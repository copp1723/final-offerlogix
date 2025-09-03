import type { Config } from 'drizzle-kit';

export default {
  schema: './schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL + (process.env.DATABASE_URL?.includes('postgres.render.com') ? '?sslmode=require' : ''),
    ssl: process.env.DATABASE_URL?.includes('postgres.render.com')
      ? { rejectUnauthorized: false }
      : process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  },
  verbose: true,
  strict: true,
} satisfies Config;