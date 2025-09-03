/**
 * Database Connection
 * PostgreSQL connection using Drizzle ORM
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Database connection string
const connectionString = process.env.DATABASE_URL || 
  'postgresql://user:password@localhost:5432/mailmind';

// Create the connection
const queryClient = postgres(connectionString);

// Create drizzle instance
export const db = drizzle(queryClient, { schema });

// Export for use in services
export type Database = typeof db;
