import dotenv from 'dotenv';

// Load .env file
console.log('🔍 Loading environment variables...');
const result = dotenv.config();

if (result.error) {
  console.error('❌ Error loading .env file:', result.error);
} else {
  console.log('✅ .env file loaded successfully');
}

console.log('\n📋 Environment Variables Check:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing');
console.log('APP_URL:', process.env.APP_URL ? '✅ Set' : '❌ Missing');
console.log('CLIENT_URL:', process.env.CLIENT_URL ? '✅ Set' : '❌ Missing');
console.log('MAILGUN_API_KEY:', process.env.MAILGUN_API_KEY ? '✅ Set' : '❌ Missing');
console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? '✅ Set' : '❌ Missing');
console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? '✅ Set' : '❌ Missing');

console.log('\n🔍 Full process.env keys count:', Object.keys(process.env).length);
