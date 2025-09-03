# MailMind Security Implementation

## Overview

This document describes the comprehensive security implementation for the MailMind application, providing enterprise-grade protection against common web application vulnerabilities and attacks.

## 🛡️ Security Features Implemented

### 1. Rate Limiting & Throttling

**Multi-tier Rate Limiting:**
- **General API**: 100 requests per 15 minutes per IP (standard tier)
- **Authentication**: 5 requests per 15 minutes per IP
- **File Uploads**: 10 requests per hour per user
- **AI/LLM Endpoints**: 20 requests per minute per user
- **Unauthenticated**: 50 requests per 15 minutes per IP

**Dynamic Rate Limiting:**
- Different limits for authenticated vs unauthenticated users
- API key-based tier system (standard, premium, enterprise)
- Database-backed rate limit tracking
- Automatic cleanup of old rate limit records
- Route-specific limits for preview, send and webhook endpoints

### 2. API Key Management

**Secure API Key System:**
- SHA-256 hashed storage (never store plain text keys)
- Prefix-based identification (mk_live_*, mk_test_*)
- Configurable permissions system
- Expiration dates and automatic cleanup
- Usage tracking and analytics

**Permission System:**
```typescript
enum ApiPermission {
  READ_LEADS = 'read:leads',
  WRITE_CAMPAIGNS = 'write:campaigns',
  ADMIN = 'admin',
  AI_PROCESSING = 'ai:processing',
  // ... and more
}
```

### 3. Input Validation & Sanitization

**Multi-layer Protection:**
- Zod schema validation
- Express-validator integration
- XSS prevention (HTML tag removal)
- SQL injection detection and blocking
- Path traversal protection
- NoSQL injection prevention
- Request size limits (10MB default)
- JSON depth validation (max 10 levels)
- Configurable payload limits for API and webhook requests
- HTML template sanitizer with allowlisted tags (rejects disallowed tags with HTTP 400)

**Security Pattern Detection:**
- SQL injection patterns
- XSS attack patterns
- Command injection attempts
- Path traversal attempts
- NoSQL injection patterns

### 4. Security Headers

**Comprehensive Header Protection:**
```typescript
// HSTS (HTTP Strict Transport Security)
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

// Content Security Policy
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'

// XSS Protection
X-XSS-Protection: 1; mode=block
X-Content-Type-Options: nosniff
X-Frame-Options: DENY

// Additional Security
Referrer-Policy: no-referrer-when-downgrade
X-Permitted-Cross-Domain-Policies: none
```

### 5. Attack Protection

**Advanced Attack Detection:**
- Real-time attack pattern matching
- Suspicious user agent detection (security scanners)
- Honeypot field detection (bot prevention)
- IP-based threat tracking
- Automatic suspicious IP blocking

**Protection Against:**
- SQL Injection
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- Path Traversal
- Command Injection
- Server-Side Template Injection (SSTI)
- XML External Entity (XXE) attacks

### 6. Security Monitoring & Logging

**Comprehensive Logging:**
- Security event tracking
- Failed authentication attempts
- Rate limit violations
- Attack attempt detection
- API key usage monitoring
- Request/response logging with Morgan

**Security Metrics:**
- Real-time security dashboard
- Attack statistics
- API key usage analytics
- Rate limit monitoring
- Suspicious activity alerts

### 7. File Upload Security

**Secure File Handling:**
- File type validation (whitelist approach)
- File size limits (10MB default)
- Filename security checks
- Content scanning for malicious patterns
- Maximum files per request limit

**Allowed File Types:**
- text/csv
- application/json
- image/png, image/jpeg, image/gif
- application/pdf
- text/plain

## 🔧 Configuration Management

### Environment-Based Security

**Development Mode:**
- Relaxed rate limiting
- Detailed security logging
- CSP disabled for development tools
- Test API endpoints enabled

**Production Mode:**
- Strict rate limiting
- Maximum security headers
- Attack protection enabled
- Comprehensive monitoring

### Security Configuration API

Access security settings via admin endpoints:
```bash
GET /api/security/health      # Security health check
GET /api/security/config      # Current configuration
PUT /api/security/config      # Update configuration
GET /api/security/metrics     # Security metrics
GET /api/security/attacks     # Attack statistics
```

## 🚨 Security Endpoints

### API Key Management
```bash
GET /api/security/api-keys         # List API keys
POST /api/security/api-keys        # Create new API key
DELETE /api/security/api-keys/:id  # Revoke API key
GET /api/security/api-keys/stats   # API key statistics
```

### Security Monitoring
```bash
GET /api/security/health    # Overall security status
GET /api/security/metrics   # Security metrics and events
GET /api/security/attacks   # Attack detection statistics
```

## 📋 Implementation Details

### Middleware Stack Order
1. **Helmet** - Basic security headers
2. **Request Size Validation** - Prevent DoS via large payloads
3. **JSON Depth Validation** - Prevent deep object attacks
4. **Security Logging** - Track all requests
5. **Enhanced Security Headers** - Custom security headers
6. **IP Filtering** - Whitelist/blacklist functionality
7. **Attack Protection** - Pattern-based attack detection
8. **Rate Limiting** - Request throttling
9. **API Key Validation** - Authentication and authorization

### Database Schema

**API Keys Table:**
```sql
CREATE TABLE api_keys (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash varchar(255) NOT NULL UNIQUE,
  key_prefix varchar(8) NOT NULL,
  name varchar(255) NOT NULL,
  permissions jsonb DEFAULT '[]'::jsonb,
  rate_limit_tier varchar(20) DEFAULT 'standard',
  is_active boolean DEFAULT true,
  expires_at timestamp,
  last_used timestamp,
  created_at timestamp DEFAULT now()
);
```

**Rate Limit Tracking:**
```sql
CREATE TABLE rate_limit_attempts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier varchar(255) NOT NULL,
  endpoint varchar(255) NOT NULL,
  attempts integer DEFAULT 1,
  window_start timestamp DEFAULT now(),
  window_end timestamp NOT NULL,
  created_at timestamp DEFAULT now()
);
```

## 🧪 Testing Security Implementation

Run the comprehensive security test suite:

```bash
node test-security-implementation.js
```

**Test Categories:**
1. Security Headers Validation
2. Rate Limiting Functionality
3. Input Validation & Attack Detection
4. API Key Authentication
5. CORS Configuration
6. Security Endpoint Protection
7. File Upload Security

## 🔑 API Key Usage

### Creating API Keys

```bash
curl -X POST /api/security/api-keys \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_ADMIN_KEY" \
  -d '{
    "name": "My Application",
    "description": "Main application API key",
    "permissions": ["read:leads", "write:campaigns"],
    "rateLimitTier": "premium"
  }'
```

### Using API Keys

Include API key in requests:
```bash
# Via header (recommended)
curl -H "X-API-Key: mk_live_your_api_key_here" /api/leads

# Via Authorization header
curl -H "Authorization: Bearer mk_live_your_api_key_here" /api/leads
```

## 📊 Security Metrics

Monitor security via the metrics endpoint:
```json
{
  "timestamp": "2025-08-20T10:00:00Z",
  "totalEvents": 1234,
  "suspiciousActivity": 5,
  "eventTypes": {
    "auth_success": 850,
    "auth_failure": 23,
    "rate_limit_exceeded": 45,
    "validation_failure": 12
  },
  "topIps": [
    {"ip": "192.168.1.1", "count": 156},
    {"ip": "10.0.0.1", "count": 89}
  ]
}
```

## 🚀 Deployment Considerations

### Environment Variables

```bash
# Security Configuration
RATE_LIMIT_ENABLED=true
API_KEY_REQUIRED=true
MAX_REQUEST_SIZE=10485760
ATTACK_PROTECTION=true
LOG_SECURITY_EVENTS=true

# Production Settings
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
DATABASE_URL=postgresql://...
```

### Production Checklist

- [ ] Enable HTTPS/TLS encryption
- [ ] Configure proper CORS origins
- [ ] Set up external logging service integration
- [ ] Enable rate limiting
- [ ] Configure API key authentication
- [ ] Set up monitoring and alerting
- [ ] Regular security audits
- [ ] Database backup encryption
- [ ] Implement security headers
- [ ] Configure firewalls and network security

## 🛠️ Maintenance

### Regular Tasks

1. **API Key Rotation**: Rotate API keys regularly
2. **Rate Limit Cleanup**: Automatic cleanup runs hourly
3. **Security Log Review**: Monitor for suspicious patterns
4. **Configuration Updates**: Keep security configs updated
5. **Dependency Updates**: Regular security updates

### Monitoring Alerts

Set up alerts for:
- High rate of authentication failures
- Unusual attack patterns
- API key usage spikes
- Security endpoint access
- Failed validation attempts

## 📞 Incident Response

In case of security incidents:

1. **Immediate Response**:
   - Check security metrics endpoint
   - Review recent security logs
   - Identify affected API keys or IPs
   - Temporarily block suspicious sources

2. **Investigation**:
   - Analyze attack patterns
   - Check for data exposure
   - Review access logs
   - Assess damage scope

3. **Recovery**:
   - Revoke compromised API keys
   - Update security configurations
   - Patch vulnerabilities
   - Notify stakeholders

## 🔗 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)

---

**Last Updated**: August 20, 2025  
**Version**: 1.0.0  
**Security Level**: Enterprise-Grade