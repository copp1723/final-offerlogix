#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://ccl_3_user:P8LUqfkbIB4noaUDthVtZETTWZR668nI@dpg-d1lvpq6r433s73e9vfu0-a.oregon-postgres.render.com/ccl_3',
  ssl: { rejectUnauthorized: false }
});

// Campaign IDs for Lake Geneva
const CAMPAIGNS = {
  suvs: 'be9a537f-c127-4fc7-b5d1-919c059f4355',
  trucks: '230caf8c-a3e2-4c8e-8cf7-9bf6d7b3e2d1'
};

const AGENT_ID = 'e53c0a2e-41df-4f6b-9332-476230bbf810'; // Kaitlyn Fischer

// Vehicle classification
const TRUCK_MODELS = [
  'F-150', 'F-250', 'F-350', 'SILVERADO', 'SIERRA', 'RAM', '1500', '2500', '3500',
  'COLORADO', 'CANYON', 'RANGER', 'TACOMA', 'TUNDRA', 'TITAN', 'FRONTIER',
  'RIDGELINE', 'AVALANCHE', 'ESCALADE EXT'
];

const SUV_MODELS = [
  'TAHOE', 'SUBURBAN', 'YUKON', 'ESCALADE', 'TRAVERSE', 'EQUINOX', 'BLAZER',
  'TRAILBLAZER', 'ACADIA', 'TERRAIN', 'ENVISION', 'ENCLAVE', 'ENCORE',
  'EXPLORER', 'EXPEDITION', 'ESCAPE', 'EDGE', 'BRONCO', 'ECOSPORT',
  'WRANGLER', 'GRAND CHEROKEE', 'CHEROKEE', 'COMPASS', 'RENEGADE',
  'PATHFINDER', 'ARMADA', 'MURANO', 'ROGUE', 'KICKS', 'JUKE',
  'PILOT', 'PASSPORT', 'CR-V', 'HR-V', 'RIDGELINE',
  'HIGHLANDER', '4RUNNER', 'SEQUOIA', 'LAND CRUISER', 'RAV4', 'VENZA',
  'CX-5', 'CX-9', 'CX-3', 'CX-30'
];

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

function classifyVehicle(model) {
  const modelUpper = (model || '').toUpperCase();
  
  // Check if it's a truck
  if (TRUCK_MODELS.some(truck => modelUpper.includes(truck))) {
    return 'truck';
  }
  
  // Check if it's an SUV
  if (SUV_MODELS.some(suv => modelUpper.includes(suv))) {
    return 'suv';
  }
  
  // Default classification based on common patterns
  if (modelUpper.includes('PICKUP') || modelUpper.includes('TRUCK')) {
    return 'truck';
  }
  
  if (modelUpper.includes('SUV') || modelUpper.includes('CROSSOVER')) {
    return 'suv';
  }
  
  // Default to SUV for unknown models
  return 'suv';
}

async function importLeads() {
  const client = await pool.connect();
  
  try {
    console.log('🚗 Importing Lake Geneva leads...');
    
    const allData = parseCSV('./lake-geneva-leads.csv');
    console.log(`Found ${allData.length} total leads`);
    
    let suvImported = 0;
    let truckImported = 0;
    
    for (const row of allData) {
      const email = (row.Email1 || row.email || '').toLowerCase().trim();
      if (!email || email === '' || email.includes('noemail') || email.includes('declined')) {
        continue; // Skip invalid emails
      }
      
      const { firstName, lastName } = extractName(row.FullName);
      const vehicleType = classifyVehicle(row.Model);
      const campaignId = vehicleType === 'truck' ? CAMPAIGNS.trucks : CAMPAIGNS.suvs;
      
      try {
        await client.query(
          `INSERT INTO leads_v2 (agent_id, campaign_id, email, first_name, last_name, metadata) 
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (campaign_id, email) DO NOTHING`,
          [
            AGENT_ID,
            campaignId,
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
              zip: row.Zip || '',
              vehicleType: vehicleType
            })
          ]
        );
        
        if (vehicleType === 'truck') {
          truckImported++;
        } else {
          suvImported++;
        }
        
        console.log(`✅ ${email} -> ${vehicleType.toUpperCase()} (${row.Make} ${row.Model})`);
      } catch (err) {
        console.warn(`⚠️  Skipped lead ${email}: ${err.message}`);
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
