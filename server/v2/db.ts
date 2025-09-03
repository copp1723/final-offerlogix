import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from '../db';
import * as schema from './schema/index.js';

export const dbV2 = drizzle(pool, { schema });
export * as v2schema from './schema/index.js';
