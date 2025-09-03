# System Configuration Guide

Complete setup and configuration reference for OneKeel Swarm administrators. This guide covers environment setup, API integrations, security configuration, and system optimization.

## Environment Setup

### Required Environment Variables

#### Core Platform Configuration
```bash
# Database Configuration (Auto-configured in Replit)
DATABASE_URL=postgresql://username:password@host:port/database

# Application Settings
NODE_ENV=production
PORT=5000
REPLIT_DOMAINS=your-app-name.replit.app

# Security
SESSION_SECRET=your-secure-session-secret-here
API_KEY_SALT=your-api-key-encryption-salt
```

#### Email Infrastructure
```bash
# Mailgun Configuration (Required)
MAILGUN_DOMAIN=mg.yourdealership.com
MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MAILGUN_FROM_NAME="Your Dealership Name"
MAILGUN_FROM_EMAIL=noreply@yourdealership.com

# Email Authentication
MAILGUN_WEBHOOK_SECRET=your-webhook-secret
MAILGUN_REGION=us  # or 'eu' for European data centers

# Default send window for follow-up emails (optional)
# JSON string e.g. {"tz":"America/Chicago","start":"08:00","end":"19:00"}
DEFAULT_SEND_WINDOW=
```

#### AI Services
```bash
# OpenRouter API (Required for AI features)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENROUTER_SITE_URL=https://yourdealership.com
OPENROUTER_SITE_NAME="Your Dealership Name"

# Supermemory Configuration
SUPERMEMORY_API_KEY=your-supermemory-api-key
SUPERMEMORY_BASE_URL=https://api.supermemory.ai
```

#### SMS Integration (Optional)
```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+15551234567
```

#### Email Monitoring (Optional)
```bash
# Gmail IMAP for email monitoring
GMAIL_USER=your-monitoring-email@gmail.com
GMAIL_PASSWORD=your-app-specific-password
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
```

### Development vs Production Configuration

#### Development Environment
```bash
NODE_ENV=development
DEBUG=onekeel:*
LOG_LEVEL=debug

# Use staging APIs
OPENROUTER_API_KEY=sk-or-v1-staging-key
MAILGUN_DOMAIN=sandbox123.mailgun.org
```

#### Production Environment
```bash
NODE_ENV=production
LOG_LEVEL=info

# Production API keys
OPENROUTER_API_KEY=sk-or-v1-production-key
MAILGUN_DOMAIN=mg.yourdealership.com

# Additional production settings
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=1000
```

## API Key Management

### Obtaining Required API Keys

#### OpenRouter API Key
1. **Sign Up**: Visit https://openrouter.ai
2. **Create Account**: Use your dealership email
3. **Generate Key**: Go to Settings → API Keys → Create
4. **Set Credits**: Add initial credits for AI usage
5. **Configure**: Add to environment variables

**Usage Monitoring:**
```javascript
// Check API usage
const usage = await fetch('https://openrouter.ai/api/v1/auth/key', {
  headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }
});
```

#### Mailgun API Key
1. **Account Setup**: Create account at https://mailgun.com
2. **Domain Verification**: Add your sending domain
3. **DNS Configuration**: Add required SPF, DKIM, DMARC records
4. **API Key**: Copy from Mailgun dashboard
5. **Test Setup**: Send test email to verify configuration

**DNS Records Required:**
```
TXT @ "v=spf1 include:mailgun.org ~all"
TXT mailgun._domainkey.mg "k=rsa; p=YOUR_DKIM_PUBLIC_KEY"
TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdealership.com"
```

#### Twilio API Credentials (SMS)
1. **Account Creation**: Sign up at https://twilio.com
2. **Phone Number**: Purchase a phone number for SMS
3. **API Credentials**: Copy Account SID and Auth Token
4. **Webhook Configuration**: Set up SMS response webhooks

### API Key Security Best Practices

#### Storage and Rotation
```bash
# Use environment variables, never hardcode
OPENROUTER_API_KEY=${OPENROUTER_API_KEY}

# Rotate keys quarterly
# Old key: sk-or-v1-old-key-xxxx
# New key: sk-or-v1-new-key-xxxx

# Update and test before removing old key
```

#### Access Control
- **Principle of Least Privilege**: Only grant necessary permissions
- **Environment Separation**: Different keys for dev/staging/production
- **Team Access**: Limit API key access to essential team members
- **Monitoring**: Track API key usage and unusual patterns

#### Key Validation
```javascript
// Validate API keys on startup
async function validateApiKeys() {
  const validations = [
    { name: 'OpenRouter', test: () => testOpenRouterConnection() },
    { name: 'Mailgun', test: () => testMailgunConnection() },
    { name: 'Twilio', test: () => testTwilioConnection() }
  ];

  for (const validation of validations) {
    try {
      await validation.test();
      console.log(`✓ ${validation.name} API key valid`);
    } catch (error) {
      console.error(`✗ ${validation.name} API key invalid:`, error.message);
    }
  }
}
```

## Database Configuration

### PostgreSQL Setup and Optimization

#### Connection Configuration
```javascript
// Drizzle configuration
export const db = drizzle(postgres(process.env.DATABASE_URL!), {
  schema,
  logger: process.env.NODE_ENV === 'development'
});

// Connection pool settings
const poolConfig = {
  max: 20,          // Maximum connections
  min: 5,           // Minimum connections
  idle: 10000,      // Idle timeout (10 seconds)
  acquire: 60000,   // Acquire timeout (60 seconds)
  evict: 1000       // Eviction run interval
};
```

#### Performance Optimization
```sql
-- Essential indexes for performance
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_vehicle_interest ON leads(vehicle_interest);
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);

-- Composite indexes for common queries
CREATE INDEX idx_leads_status_vehicle ON leads(status, vehicle_interest);
CREATE INDEX idx_campaigns_status_type ON campaigns(status, type);
```

#### Backup and Recovery
```bash
# Automated backup script
#!/bin/bash
DATE=$(date +"%Y%m%d_%H%M%S")
pg_dump $DATABASE_URL > backup_${DATE}.sql

# Retention policy (keep 30 days)
find /backups -name "backup_*.sql" -mtime +30 -delete

# Upload to cloud storage
aws s3 cp backup_${DATE}.sql s3://your-backup-bucket/
```

### Data Migration and Schema Updates

#### Schema Migration Process
```bash
# Generate migration
npm run db:generate

# Review migration file
cat drizzle/migrations/xxxx_migration_name.sql

# Apply migration to development
npm run db:push

# Apply to production (with backup)
pg_dump $PROD_DATABASE_URL > pre_migration_backup.sql
npm run db:migrate
```

#### Data Validation
```javascript
// Post-migration validation
async function validateMigration() {
  const checks = [
    { name: 'Leads count', query: 'SELECT COUNT(*) FROM leads' },
    { name: 'Campaigns count', query: 'SELECT COUNT(*) FROM campaigns' },
    { name: 'Foreign key integrity', query: 'SELECT COUNT(*) FROM conversations c LEFT JOIN leads l ON c.lead_id = l.id WHERE l.id IS NULL' }
  ];

  for (const check of checks) {
    const result = await db.execute(sql`${check.query}`);
    console.log(`${check.name}: ${result[0]}`);
  }
}
```

## Security Configuration

### Authentication and Authorization

#### Session Configuration
```javascript
// Express session setup
app.use(session({
  store: new pgSession({
    pool: postgresPool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

#### API Key Authentication
```javascript
// API key middleware
export function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '');
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  // Validate API key against database
  const user = validateApiKey(apiKey);
  if (!user) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  req.user = user;
  next();
}
```

#### Role-Based Access Control
```javascript
// Permission system
const permissions = {
  admin: ['read', 'write', 'delete', 'manage_users'],
  manager: ['read', 'write', 'manage_campaigns'],
  user: ['read', 'write_own']
};

function hasPermission(userRole, requiredPermission) {
  return permissions[userRole]?.includes(requiredPermission) || false;
}

// Middleware
export function requirePermission(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
```

### Data Encryption and Privacy

#### Sensitive Data Encryption
```javascript
import crypto from 'crypto';

// Encrypt PII data
export function encryptPII(data) {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipher(algorithm, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

// Decrypt PII data
export function decryptPII(encryptedData) {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
  
  const decipher = crypto.createDecipher(
    algorithm, 
    key, 
    Buffer.from(encryptedData.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

#### GDPR Compliance Configuration
```javascript
// Data retention policies
const retentionPolicies = {
  leads: '7 years',           // Automotive industry standard
  conversations: '3 years',   // Customer service records
  analytics: '2 years',       // Marketing analytics
  logs: '1 year'             // System logs
};

// Data anonymization
export function anonymizeLeadData(lead) {
  return {
    ...lead,
    email: hashEmail(lead.email),
    firstName: 'REDACTED',
    lastName: 'REDACTED',
    phone: 'REDACTED',
    // Keep non-PII data for analytics
    vehicleInterest: lead.vehicleInterest,
    source: lead.source,
    createdAt: lead.createdAt
  };
}
```

## White Label Configuration

### Multi-Tenant Setup

#### Client Configuration Schema
```javascript
// Client branding configuration
export const clientBrandingSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  brandingConfig: z.object({
    primaryColor: z.string(),
    secondaryColor: z.string(),
    logoUrl: z.string().optional(),
    companyName: z.string(),
    favicon: z.string().optional(),
    customCss: z.string().optional(),
    emailTemplateColors: z.object({
      headerBackground: z.string(),
      buttonColor: z.string(),
      accentColor: z.string()
    }).optional()
  })
});
```

#### Tenant Middleware
```javascript
// Tenant resolution middleware
export async function tenantMiddleware(req, res, next) {
  const domain = req.get('host') || req.body.domain || 'default';
  
  // Resolve tenant from domain
  const tenant = await resolveTenant(domain);
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }
  
  req.tenant = tenant;
  req.clientId = tenant.id;
  next();
}

async function resolveTenant(domain) {
  // Check cache first
  const cached = tenantCache.get(domain);
  if (cached) return cached;
  
  // Query database
  const tenant = await db.select().from(clients).where(eq(clients.domain, domain));
  
  if (tenant.length > 0) {
    tenantCache.set(domain, tenant[0]);
    return tenant[0];
  }
  
  return null;
}
```

#### Custom Branding Implementation
```javascript
// Dynamic CSS generation
export function generateCustomCSS(brandingConfig) {
  return `
    :root {
      --primary-color: ${brandingConfig.primaryColor};
      --secondary-color: ${brandingConfig.secondaryColor};
      --company-name: "${brandingConfig.companyName}";
    }
    
    .header-logo {
      background-image: url('${brandingConfig.logoUrl}');
    }
    
    .btn-primary {
      background-color: var(--primary-color);
      border-color: var(--primary-color);
    }
    
    .btn-primary:hover {
      background-color: ${darkenColor(brandingConfig.primaryColor, 10)};
    }
    
    ${brandingConfig.customCss || ''}
  `;
}
```

### Domain Management

#### SSL Certificate Configuration
```bash
# Automated SSL certificate management with Let's Encrypt
certbot certonly --webroot \
  -w /var/www/html \
  -d yourdealership.com \
  -d mg.yourdealership.com \
  --email admin@yourdealership.com \
  --agree-tos \
  --non-interactive

# Auto-renewal configuration
0 12 * * * /usr/bin/certbot renew --quiet
```

#### DNS Configuration Template
```
# A record for main domain
yourdealership.com.    IN  A      YOUR_SERVER_IP

# CNAME for Mailgun subdomain
mg.yourdealership.com. IN  CNAME  mailgun.org.

# SPF record for email authentication
yourdealership.com.    IN  TXT    "v=spf1 include:mailgun.org ~all"

# DKIM record for email signing
mailgun._domainkey.mg.yourdealership.com. IN TXT "k=rsa; p=YOUR_DKIM_KEY"

# DMARC record for email policy
_dmarc.yourdealership.com. IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdealership.com"
```

## Performance Configuration

### Application Optimization

#### Caching Strategy
```javascript
import NodeCache from 'node-cache';

// Multi-level caching
const caches = {
  tenants: new NodeCache({ stdTTL: 3600 }),     // 1 hour
  campaigns: new NodeCache({ stdTTL: 300 }),    // 5 minutes
  leads: new NodeCache({ stdTTL: 60 }),         // 1 minute
  analytics: new NodeCache({ stdTTL: 1800 })    // 30 minutes
};

// Cache middleware
export function cacheMiddleware(cacheType, keyGenerator, ttl) {
  return async (req, res, next) => {
    const key = keyGenerator(req);
    const cached = caches[cacheType].get(key);
    
    if (cached) {
      return res.json(cached);
    }
    
    // Override res.json to cache result
    const originalJson = res.json;
    res.json = function(data) {
      caches[cacheType].set(key, data, ttl);
      return originalJson.call(this, data);
    };
    
    next();
  };
}
```

#### Database Connection Pooling
```javascript
// Optimized connection pool
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Maximum pool size
  min: 5,                     // Minimum pool size
  idle: 10000,                // Idle timeout
  acquire: 30000,             // Acquire timeout
  evict: 1000,                // Eviction run interval
  handleDisconnects: true,    // Handle disconnections
  validate: (client) => {     // Connection validation
    return client.query('SELECT 1');
  }
};
```

### Monitoring and Logging

#### Application Monitoring
```javascript
import winston from 'winston';

// Structured logging configuration
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'onekeel-swarm' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Performance monitoring
export function performanceMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  
  next();
}
```

#### Health Check Configuration
```javascript
// Comprehensive health checks
export async function healthCheck() {
  const checks = {
    database: await checkDatabase(),
    mailgun: await checkMailgun(),
    openrouter: await checkOpenRouter(),
    memory: checkMemoryUsage(),
    disk: await checkDiskSpace()
  };
  
  const isHealthy = Object.values(checks).every(check => check.status === 'healthy');
  
  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks
  };
}

// Individual health check functions
async function checkDatabase() {
  try {
    await db.execute(sql`SELECT 1`);
    return { status: 'healthy', latency: Date.now() - start };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}
```

## Troubleshooting Common Issues

### Configuration Problems

#### Environment Variable Issues
```bash
# Debugging environment variables
echo "Checking environment variables..."
echo "NODE_ENV: $NODE_ENV"
echo "DATABASE_URL: ${DATABASE_URL:0:20}..." # Show only first 20 chars
echo "MAILGUN_DOMAIN: $MAILGUN_DOMAIN"
echo "OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:0:10}..."

# Validate required variables
required_vars=("DATABASE_URL" "MAILGUN_API_KEY" "OPENROUTER_API_KEY")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "ERROR: $var is not set"
  else
    echo "✓ $var is configured"
  fi
done
```

#### API Connection Issues
```javascript
// Diagnostic API testing
export async function diagnoseAPIs() {
  const tests = [
    {
      name: 'OpenRouter',
      test: () => fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }
      })
    },
    {
      name: 'Mailgun',
      test: () => fetch(`https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
        headers: { Authorization: `api:${process.env.MAILGUN_API_KEY}` }
      })
    }
  ];
  
  for (const test of tests) {
    try {
      const response = await test.test();
      console.log(`✓ ${test.name}: ${response.status}`);
    } catch (error) {
      console.error(`✗ ${test.name}: ${error.message}`);
    }
  }
}
```

### Performance Issues

#### Database Performance Debugging
```sql
-- Check slow queries
SELECT query, mean_exec_time, calls, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check connection usage
SELECT 
  state,
  count(*)
FROM pg_stat_activity
GROUP BY state;
```

#### Memory Usage Monitoring
```javascript
// Memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  logger.info('Memory usage', {
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    external: Math.round(usage.external / 1024 / 1024) + 'MB'
  });
}, 60000); // Log every minute
```

---

This configuration guide provides the foundation for a robust, secure, and performant OneKeel Swarm deployment. Follow these guidelines to ensure optimal system operation and easy maintenance.