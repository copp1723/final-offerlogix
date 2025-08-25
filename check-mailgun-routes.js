#!/usr/bin/env node

// Check Mailgun routes for inbound email handling
const MAILGUN_API_KEY = 'f710691aaf88ffc683699386bcadb2e5-97129d72-433bb02c';
const MAILGUN_DOMAIN = 'mail.offerlogix.me';

async function checkMailgunRoutes() {
  console.log('Checking Mailgun routes for inbound email handling...');
  
  const url = `https://api.mailgun.net/v3/routes`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`,
      }
    });
    
    if (!response.ok) {
      console.error(`API Error ${response.status}:`, await response.text());
      return;
    }
    
    const data = await response.json();
    console.log('\n📬 Mailgun Routes Configuration:');
    
    if (data.items && data.items.length > 0) {
      data.items.forEach((route, index) => {
        console.log(`\n${index + 1}. Route ID: ${route.id}`);
        console.log(`   Expression: ${route.expression}`);
        console.log(`   Priority: ${route.priority}`);
        console.log(`   Actions: ${JSON.stringify(route.actions, null, 2)}`);
        console.log(`   Description: ${route.description || 'No description'}`);
        
        // Check if this route handles our domain
        if (route.expression.includes('mail.offerlogix.me') || route.expression.includes('brittany@mail.offerlogix.me')) {
          console.log(`   ✅ This route handles mail.offerlogix.me emails`);
        }
      });
      
      // Check specifically for brittany@mail.offerlogix.me routing
      const brittanyRoutes = data.items.filter(route => 
        route.expression.includes('brittany@mail.offerlogix.me') || 
        route.expression.includes('*@mail.offerlogix.me') ||
        route.expression.includes('match_recipient(".*@mail.offerlogix.me")')
      );
      
      if (brittanyRoutes.length > 0) {
        console.log('\n✅ Found routes that should handle brittany@mail.offerlogix.me');
      } else {
        console.log('\n❌ NO ROUTES found to handle brittany@mail.offerlogix.me');
        console.log('\n🔧 You need to create a route like:');
        console.log('   Expression: match_recipient("brittany@mail.offerlogix.me")');
        console.log('   Action: forward("https://final-offerlogix.onrender.com/api/webhooks/mailgun/inbound")');
      }
      
    } else {
      console.log('❌ No routes configured!');
      console.log('\n🔧 You need to create inbound email routes in Mailgun:');
      console.log('1. Go to your Mailgun dashboard');
      console.log('2. Navigate to Sending > Routes');
      console.log('3. Create a new route with:');
      console.log('   - Expression: match_recipient("brittany@mail.offerlogix.me")');
      console.log('   - Action: forward("https://final-offerlogix.onrender.com/api/webhooks/mailgun/inbound")');
    }
    
  } catch (error) {
    console.error('Error checking routes:', error.message);
  }
  
  // Also check MX records
  console.log('\n📡 Checking MX records for mail.offerlogix.me...');
  try {
    const { execSync } = require('child_process');
    const mxResult = execSync('nslookup -type=MX mail.offerlogix.me', { encoding: 'utf-8' });
    console.log(mxResult);
  } catch (error) {
    console.log('❌ Could not resolve MX records for mail.offerlogix.me');
    console.log('This means the domain cannot receive emails!');
    console.log('\n🔧 You need to add MX records pointing to Mailgun:');
    console.log('   MX 10 mxa.mailgun.org');
    console.log('   MX 10 mxb.mailgun.org');
  }
}

checkMailgunRoutes();