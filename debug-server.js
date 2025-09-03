// Emergency debug server to identify startup issues
import express from 'express';

console.log('🔍 DEBUG: Starting emergency server...');
console.log('🔍 NODE_ENV:', process.env.NODE_ENV);
console.log('🔍 PORT:', process.env.PORT);
console.log('🔍 DATABASE_URL exists:', !!process.env.DATABASE_URL);

const app = express();
const port = process.env.PORT || 10000;

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.send('Emergency debug server is running');
});

try {
  app.listen(port, '0.0.0.0', () => {
    console.log('✅ Emergency server running on port:', port);
  });
} catch (error) {
  console.error('❌ Server failed to start:', error);
  process.exit(1);
}