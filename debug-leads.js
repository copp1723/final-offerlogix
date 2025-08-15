#!/usr/bin/env node

// Debug script to trace lead upload issues
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

async function debugLeadsIssue() {
  console.log('🔍 Debugging lead upload issue...\n');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found');
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    console.log('1. Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connected successfully\n');
    
    // Check if tables exist
    console.log('2. Checking table existence...');
    const tablesQuery = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('leads', 'campaigns', 'clients')
      ORDER BY table_name
    `);
    
    console.log('Tables found:', tablesQuery.rows);
    console.log('');
    
    // Check leads table structure
    console.log('3. Checking leads table structure...');
    const columnsQuery = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'leads'
      ORDER BY ordinal_position
    `);
    
    console.log('Leads table columns:');
    columnsQuery.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    console.log('');
    
    // Check existing leads count
    console.log('4. Checking existing leads...');
    const leadsCount = await client.query('SELECT COUNT(*) as count FROM leads');
    console.log(`Total leads in database: ${leadsCount.rows[0].count}`);
    
    if (leadsCount.rows[0].count > 0) {
      const sampleLeads = await client.query('SELECT id, email, first_name, last_name, client_id, campaign_id, created_at FROM leads ORDER BY created_at DESC LIMIT 5');
      console.log('Sample leads:');
      sampleLeads.rows.forEach(lead => {
        console.log(`  - ID: ${lead.id}, Email: ${lead.email}, Client: ${lead.client_id}, Campaign: ${lead.campaign_id}`);
      });
    }
    console.log('');
    
    // Check clients
    console.log('5. Checking clients...');
    const clientsCount = await client.query('SELECT COUNT(*) as count FROM clients');
    console.log(`Total clients: ${clientsCount.rows[0].count}`);
    
    if (clientsCount.rows[0].count > 0) {
      const clients = await client.query('SELECT id, name, domain FROM clients');
      console.log('Clients:');
      clients.rows.forEach(client => {
        console.log(`  - ID: ${client.id}, Name: ${client.name}, Domain: ${client.domain}`);
      });
    }
    console.log('');
    
    // Check campaigns
    console.log('6. Checking campaigns...');
    const campaignsCount = await client.query('SELECT COUNT(*) as count FROM campaigns');
    console.log(`Total campaigns: ${campaignsCount.rows[0].count}`);
    
    if (campaignsCount.rows[0].count > 0) {
      const campaigns = await client.query('SELECT id, name, status FROM campaigns LIMIT 5');
      console.log('Sample campaigns:');
      campaigns.rows.forEach(campaign => {
        console.log(`  - ID: ${campaign.id}, Name: ${campaign.name}, Status: ${campaign.status}`);
      });
    }
    console.log('');
    
    // Test creating a lead
    console.log('7. Testing lead creation...');
    const testLeadId = randomUUID();
    const testEmail = `test-${Date.now()}@example.com`;
    
    // First, get or create a client
    let clientId = null;
    const defaultClient = await client.query("SELECT id FROM clients WHERE domain = 'localhost' LIMIT 1");
    if (defaultClient.rows.length > 0) {
      clientId = defaultClient.rows[0].id;
    } else {
      console.log('Creating default client...');
      const newClient = await client.query(`
        INSERT INTO clients (name, domain, branding_config, settings)
        VALUES ('Default Client', 'localhost', '{}', '{}')
        RETURNING id
      `);
      clientId = newClient.rows[0].id;
    }
    
    console.log(`Using client ID: ${clientId}`);
    
    const insertResult = await client.query(`
      INSERT INTO leads (id, email, first_name, last_name, client_id, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [testLeadId, testEmail, 'Test', 'Lead', clientId, 'new']);
    
    console.log('✅ Test lead created successfully:', insertResult.rows[0]);
    console.log('');
    
    // Verify the lead can be retrieved
    console.log('8. Testing lead retrieval...');
    const retrievedLead = await client.query('SELECT * FROM leads WHERE email = $1', [testEmail]);
    
    if (retrievedLead.rows.length > 0) {
      console.log('✅ Test lead retrieved successfully:', retrievedLead.rows[0]);
    } else {
      console.log('❌ Test lead not found after creation');
    }
    console.log('');
    
    // Clean up test lead
    await client.query('DELETE FROM leads WHERE email = $1', [testEmail]);
    console.log('🧹 Test lead cleaned up');
    console.log('');
    
    // Check for any constraints that might prevent lead creation
    console.log('9. Checking constraints...');
    const constraints = await client.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'leads'
    `);
    
    if (constraints.rows.length > 0) {
      console.log('Foreign key constraints on leads table:');
      constraints.rows.forEach(constraint => {
        console.log(`  - ${constraint.column_name} -> ${constraint.foreign_table_name}.${constraint.foreign_column_name}`);
      });
    } else {
      console.log('No foreign key constraints found on leads table');
    }
    
    client.release();
    
  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    await pool.end();
  }
}

debugLeadsIssue().catch(console.error);