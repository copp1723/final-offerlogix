#!/usr/bin/env node

/**
 * Debug V2 router mounting issue
 */

console.log('🔍 DEBUGGING V2 ROUTER MOUNTING');
console.log('===============================');

// Test the exact logic used in routes.ts
const V2_MAILGUN_ENABLED = process.env.V2_MAILGUN_ENABLED;
console.log('V2_MAILGUN_ENABLED:', V2_MAILGUN_ENABLED);
console.log('V2_MAILGUN_ENABLED === "true":', V2_MAILGUN_ENABLED === 'true');
console.log('Condition result:', process.env.V2_MAILGUN_ENABLED === 'true');

console.log('\nEnvironment check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('All V2 vars:', Object.keys(process.env).filter(k => k.includes('V2')).map(k => `${k}=${process.env[k]}`));

// Test if we can load the router
try {
  console.log('\n🔧 Testing router import...');
  
  // This should work locally with tsx
  import('./server/v2/routes/index.ts').then(module => {
    console.log('✅ V2 router module loaded');
    const router = module.buildV2Router();
    console.log('✅ V2 router built successfully');
    console.log('Router type:', typeof router);
  }).catch(err => {
    console.error('❌ V2 router import failed:', err.message);
    console.log('\n📝 This might be normal locally - check production logs');
  });
} catch (err) {
  console.error('❌ V2 router test failed:', err.message);
}