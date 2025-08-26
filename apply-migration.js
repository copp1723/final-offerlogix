#!/usr/bin/env node

// Apply the database migration to fix the foreign key constraint
import { readFileSync } from 'fs';

async function applyMigration() {
  console.log('Applying migration to fix sender_id foreign key constraint...');
  
  const migrationSQL = readFileSync('./drizzle/0012_fix_sender_id_constraint.sql', 'utf8');
  
  console.log('Migration SQL:');
  console.log(migrationSQL);
  console.log('\nApplying to production database...');
  
  // Get database URL from environment
  const DATABASE_URL = 'postgresql://offerlogix_db_user:0qVzb7nAW0Ue1ihbTniiMon1gCfesTK4@dpg-d2edm53uibrs73ft94l0-a.oregon-postgres.render.com/offerlogix_db?sslmode=require';
  
  try {
    // Import pg dynamically
    const { Client } = await import('pg');
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    console.log('Connected to database');
    
    // Execute the migration
    await client.query(migrationSQL);
    console.log('✅ Migration applied successfully!');
    
    // Verify the constraint was updated
    const result = await client.query(`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'conversation_messages' 
      AND constraint_name = 'conversation_messages_sender_id_users_id_fk'
    `);
    
    console.log('Constraint verification:', result.rows);
    
    await client.end();
    
    console.log('\n🎉 Database migration completed!');
    console.log('The webhook should now accept emails without throwing foreign key errors.');
    console.log('Mailgun should stop rejecting emails to brittany@mail.offerlogix.me');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.message.includes('already exists')) {
      console.log('This might mean the constraint was already fixed.');
    }
  }
}

applyMigration();