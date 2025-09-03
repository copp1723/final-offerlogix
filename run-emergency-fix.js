#!/usr/bin/env node

/**
 * EMERGENCY FIX: Create missing security_audit_log table
 * This fixes the production error: relation "security_audit_log" does not exist
 */

import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runEmergencyFix() {
    console.log('🚨 EMERGENCY FIX: Creating missing security_audit_log table');
    
    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL environment variable is required');
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Read the SQL fix file
        const sqlFile = path.join(__dirname, 'fix-security-audit-table.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');

        console.log('🔧 Executing security audit table fix...');
        const result = await client.query(sql);
        
        console.log('✅ Fix applied successfully!');
        console.log('📊 Result:', result.rows[0]?.status || 'Table created');

        // Verify the table exists
        const checkResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'security_audit_log'
        `);

        if (checkResult.rows.length > 0) {
            console.log('✅ Verification: security_audit_log table exists');
        } else {
            console.log('❌ Verification failed: table not found');
        }

    } catch (error) {
        console.error('❌ Error applying fix:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Run the fix
runEmergencyFix().catch(console.error);
