
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL + (process.env.DATABASE_URL?.includes('postgres.render.com') ? '?sslmode=require' : ''),
    ssl: process.env.DATABASE_URL?.includes('postgres.render.com') 
      ? { rejectUnauthorized: false }
      : process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  },
});
