#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a.oregon-postgres.render.com/ccl_3',
  ssl: { rejectUnauthorized: false }
});

// Campaign IDs for Toyota Galesburg
const CAMPAIGNS = {
  suvs: '515da50b-244a-45c4-b1ea-41a074c99516',
  trucks: 'fcfffdd8-9a56-4b46-ae1b-2ef81a0c2ce9'
};

const AGENT_ID = 'c9df2e26-9619-4606-b825-9535217b2bd8'; // Erin Hoffman

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
}

function extractName(fullName) {
  if (!fullName) return { firstName: '', lastName: '' };
  
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  } else if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] };
  } else {
    // Handle middle names/initials - take first and last
    return { firstName: parts[0], lastName: parts[parts.length - 1] };
  }
}

async function importLeads() {
  const client = await pool.connect();
  
  try {
    console.log('🚗 Importing Toyota Galesburg leads...');
    
    // Import SUV leads
    console.log('\n📋 Processing SUV leads...');
    const suvData = parseCSV('./toyota-galesburg-suvs.csv');
    console.log(`Found ${suvData.length} SUV leads`);
    
    let suvImported = 0;
    for (const row of suvData) {
      const email = (row.email || row.Email1 || '').toLowerCase().trim();
      if (!email || email === '' || email.includes('noemail') || email.includes('declined')) {
        continue; // Skip invalid emails
      }
      
      const { firstName, lastName } = extractName(row.FullName);
      
      try {
        await client.query(
          `INSERT INTO leads_v2 (agent_id, campaign_id, email, first_name, last_name, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (campaign_id, email) DO NOTHING`,
          [
            AGENT_ID,
            CAMPAIGNS.suvs,
            email,
            firstName,
            lastName,
            JSON.stringify({
              customerId: row.CustomerId,
              vin: row.Vin,
              year: row.Year,
              make: row.Make,
              model: row.Model,
              tradeValue: row.TradeValue,
              deliveryDate: row.DeliveryDate,
              phone: row.CellPhone || row.HomePhone || '',
              address: row.AddressLine1 || '',
              city: row.City || '',
              state: row.State || '',
              zip: row.Zip || ''
            })
          ]
        );
        suvImported++;
      } catch (err) {
        console.warn(`⚠️  Skipped SUV lead ${email}: ${err.message}`);
      }
    }
    
    // Import Truck leads
    console.log('\n🚛 Processing Truck leads...');
    const truckData = parseCSV('./toyota-galesburg-trucks.csv');
    console.log(`Found ${truckData.length} Truck leads`);
    
    let truckImported = 0;
    for (const row of truckData) {
      const email = (row.Email1 || row.email || '').toLowerCase().trim();
      if (!email || email === '' || email.includes('noemail') || email.includes('declined')) {
        continue; // Skip invalid emails
      }
      
      const { firstName, lastName } = extractName(row.FullName);
      
      try {
        await client.query(
          `INSERT INTO leads_v2 (agent_id, campaign_id, email, first_name, last_name, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (campaign_id, email) DO NOTHING`,
          [
            AGENT_ID,
            CAMPAIGNS.trucks,
            email,
            firstName,
            lastName,
            JSON.stringify({
              customerId: row.CustomerId,
              vin: row.Vin,
              year: row.Year,
              make: row.Make,
              model: row.Model,
              tradeValue: row.TradeValue,
              deliveryDate: row.DeliveryDate,
              phone: row.CellPhone || row.HomePhone || '',
              address: row.AddressLine1 || '',
              city: row.City || '',
              state: row.State || '',
              zip: row.Zip || ''
            })
          ]
        );
        truckImported++;
      } catch (err) {
        console.warn(`⚠️  Skipped Truck lead ${email}: ${err.message}`);
      }
    }
    
    console.log('\n✅ Import Summary:');
    console.log(`   SUVs: ${suvImported} leads imported`);
    console.log(`   Trucks: ${truckImported} leads imported`);
    console.log(`   Total: ${suvImported + truckImported} leads imported`);
    
    // Verify the import
    const { rows: counts } = await client.query(
      `SELECT c.name, COUNT(l.id) as lead_count 
       FROM campaigns_v2 c 
       LEFT JOIN leads_v2 l ON c.id = l.campaign_id 
       WHERE c.id IN ($1, $2) 
       GROUP BY c.id, c.name 
       ORDER BY c.name`,
      [CAMPAIGNS.suvs, CAMPAIGNS.trucks]
    );
    
    console.log('\n📊 Campaign Lead Counts:');
    counts.forEach(row => {
      console.log(`   ${row.name}: ${row.lead_count} leads`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
importLeads().catch(console.error);
