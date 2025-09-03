// Quick test to check database connectivity
import dotenv from 'dotenv';
dotenv.config();

async function testDatabase() {
  try {
    console.log('📊 Testing database connection...');
    
    // Import the database instance
    const { db } = await import('./server/db.js');
    
    // Test a simple query
    const result = await db.execute('SELECT 1 as test');
    console.log('✅ Database connection successful:', result);
    
    // Try to query leads table
    try {
      const leads = await db.execute('SELECT email FROM leads LIMIT 1');
      console.log('✅ Leads table accessible');
    } catch (e) {
      console.log('⚠️ Could not query leads table:', e.message);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

testDatabase().then(success => {
  console.log('Database test result:', success ? 'PASS' : 'FAIL');
  process.exit(success ? 0 : 1);
});