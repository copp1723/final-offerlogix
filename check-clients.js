// Check what clients exist in the database
import dotenv from 'dotenv';
dotenv.config();

async function checkClients() {
  try {
    console.log('🔍 Checking all clients in database...');
    
    // Import the database instance
    const { db } = await import('./server/db.js');
    
    // Check all clients
    const clientQuery = `SELECT id, name, domain, active FROM clients ORDER BY name`;
    const clientResult = await db.execute(clientQuery);
    
    console.log(`\n📊 Found ${clientResult.rows.length} clients:`);
    clientResult.rows.forEach((client, index) => {
      console.log(`${index + 1}. ${client.name} (${client.domain || 'no domain'}) - ${client.active ? 'ACTIVE' : 'INACTIVE'}`);
    });
    
    // Check all AI agent configs
    const agentQuery = `
      SELECT ac.name, ac.agent_email_domain, ac.is_active, c.name as client_name 
      FROM ai_agent_config ac 
      LEFT JOIN clients c ON ac.client_id = c.id 
      ORDER BY c.name, ac.name
    `;
    const agentResult = await db.execute(agentQuery);
    
    console.log(`\n🤖 Found ${agentResult.rows.length} AI agent configs:`);
    agentResult.rows.forEach((agent, index) => {
      console.log(`${index + 1}. ${agent.name} (${agent.agent_email_domain || 'no domain'}) - Client: ${agent.client_name || 'ORPHANED'} - ${agent.is_active ? 'ACTIVE' : 'INACTIVE'}`);
    });
    
    return { clients: clientResult.rows, agents: agentResult.rows };
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    return false;
  }
}

checkClients().then(result => {
  if (result) {
    console.log('\n✅ Database query completed successfully');
  }
  process.exit(result ? 0 : 1);
});