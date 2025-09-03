import dotenv from 'dotenv';
dotenv.config();

async function checkDatabaseState() {
  try {
    console.log('🔍 Checking database state...');
    
    const { db } = await import('./server/db.js');
    
    // Check clients
    const clientsQuery = `SELECT id, name, domain, active FROM clients ORDER BY name`;
    const clientsResult = await db.execute(clientsQuery);
    
    console.log(`\n📊 CLIENTS (${clientsResult.rows.length}):`);
    clientsResult.rows.forEach((client, index) => {
      console.log(`${index + 1}. ${client.name} (${client.domain || 'no domain'}) - ${client.active ? 'ACTIVE' : 'INACTIVE'} - ID: ${client.id}`);
    });
    
    // Check AI agents
    const agentsQuery = `
      SELECT ac.id, ac.name, ac.agent_email_domain, ac.is_active, c.name as client_name 
      FROM ai_agent_config ac 
      LEFT JOIN clients c ON ac.client_id = c.id 
      ORDER BY c.name, ac.name
    `;
    const agentsResult = await db.execute(agentsQuery);
    
    console.log(`\n🤖 AI AGENTS (${agentsResult.rows.length}):`);
    agentsResult.rows.forEach((agent, index) => {
      console.log(`${index + 1}. ${agent.name} (${agent.agent_email_domain || 'no domain'}) - Client: ${agent.client_name || 'ORPHANED'} - ${agent.is_active ? 'ACTIVE' : 'INACTIVE'} - ID: ${agent.id}`);
    });
    
    // Check campaigns
    const campaignsQuery = `SELECT id, name, status, client_id FROM campaigns ORDER BY name`;
    const campaignsResult = await db.execute(campaignsQuery);
    
    console.log(`\n📧 CAMPAIGNS (${campaignsResult.rows.length}):`);
    campaignsResult.rows.forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.name} - Status: ${campaign.status} - Client ID: ${campaign.client_id || 'NULL'}`);
    });
    
    // Check users
    const usersQuery = `SELECT id, username, email, client_id FROM users ORDER BY username`;
    const usersResult = await db.execute(usersQuery);
    
    console.log(`\n👥 USERS (${usersResult.rows.length}):`);
    usersResult.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} (${user.email || 'no email'}) - Client ID: ${user.client_id || 'NULL'}`);
    });
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

checkDatabaseState();
