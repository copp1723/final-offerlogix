# MailMind Structured Logging Guide

## Overview

MailMind uses Winston-based structured logging to provide comprehensive observability across the application. This guide covers how to use the logging system effectively.

## Features

- **Structured JSON Logging**: All logs are formatted as JSON with consistent fields
- **Correlation IDs**: Request tracking across the entire application stack
- **Multiple Log Levels**: Debug, Info, Warn, Error, Security
- **Automatic Log Rotation**: Daily rotation with configurable retention
- **Performance Monitoring**: Built-in performance metrics tracking
- **Security Event Logging**: Enhanced security event tracking and alerting
- **Environment-Specific Configuration**: Different settings for dev/prod

## Quick Start

### Basic Usage

```typescript
import { log } from '../logging';

// Basic logging
log.info('User login successful', {
  component: 'auth',
  operation: 'user_login',
  userId: user.id
});

// Error logging
log.error('Database connection failed', {
  component: 'database',
  operation: 'connection_failed',
  error: dbError,
  severity: 'critical'
});

// Request-scoped logging
const requestLogger = log.fromRequest(req);
requestLogger.api('API endpoint called', {
  endpoint: '/api/campaigns',
  method: 'POST'
});
```

### Specialized Logging

```typescript
// Database operations
log.database('Query executed', {
  operation: 'select',
  table: 'campaigns',
  duration: 150,
  rowsAffected: 25
});

// AI/LLM operations
log.ai('LLM response generated', {
  provider: 'openai',
  model: 'gpt-4',
  tokenCount: { input: 50, output: 200, total: 250 },
  latency: 1500
});

// Performance tracking
log.performance('Campaign execution completed', {
  operation: 'campaign_execution',
  duration: 2500,
  status: 'success'
});

// Security events
log.security('Suspicious login attempt detected', {
  eventType: 'auth_failure',
  severity: 'high',
  sourceIp: '192.168.1.100',
  threatLevel: 8
});
```

## Configuration

### Environment Variables

```env
# Log level (debug, info, warn, error)
LOG_LEVEL=info

# Security logging
SECURITY_LOG_ENABLED=true
SECURITY_LOG_FILE=./logs/security.log

# Node environment
NODE_ENV=production
```

### File Structure

```
logs/
├── application-2025-08-20.log    # General application logs
├── error-2025-08-20.log          # Error logs only
├── security-2025-08-20.log       # Security events
├── debug-2025-08-20.log          # Debug logs (dev only)
├── exceptions.log                # Uncaught exceptions
└── rejections.log                # Unhandled promise rejections
```

## Log Format

All logs follow this structured format:

```json
{
  "timestamp": "2025-08-20 10:30:45.123",
  "level": "info",
  "message": "User action completed",
  "correlationId": "req_1692534645_abc123",
  "service": "mailmind-api",
  "environment": "production",
  "component": "user_management",
  "operation": "profile_update",
  "userId": "user_123",
  "duration": 250
}
```

### Standard Fields

- **timestamp**: ISO timestamp
- **level**: Log level (debug, info, warn, error, security)
- **message**: Human-readable message
- **correlationId**: Request correlation ID for tracing
- **service**: Service name (mailmind-api)
- **environment**: deployment environment
- **component**: Application component/module
- **operation**: Specific operation being performed

### Context-Specific Fields

- **userId**: User performing the action
- **tenantId**: Tenant/client context
- **requestId**: HTTP request ID
- **sessionId**: User session ID
- **ipAddress**: Client IP address
- **duration**: Operation duration (ms)
- **error**: Error details (name, message, stack)
- **statusCode**: HTTP status code

## Request Correlation

Every HTTP request gets a unique correlation ID that flows through all related log entries:

```typescript
// Middleware automatically adds correlation ID
app.use(correlationMiddleware);

// In any service/handler
const requestLogger = log.fromRequest(req);
requestLogger.info('Processing request', {
  component: 'campaign_service',
  operation: 'create_campaign'
});
```

## Performance Monitoring

Built-in performance tracking provides:

- Request count and response times
- Error rates and patterns
- Memory usage monitoring
- System health metrics

```typescript
// Automatic performance logging
log.performance('Database query completed', {
  operation: 'campaign_fetch',
  duration: 150,
  memoryUsage: process.memoryUsage(),
  status: 'success'
});

// Get current metrics
const metrics = log.getPerformanceMetrics();
```

## Security Logging

Enhanced security event tracking:

```typescript
import { EnhancedSecurityLogger } from '../logging';

// Authentication events
EnhancedSecurityLogger.logAuthEvent(
  correlationId,
  SecurityEventType.AUTH_SUCCESS,
  true,
  { userId, ip, userAgent }
);

// Rate limiting
EnhancedSecurityLogger.logRateLimitExceeded(
  correlationId,
  { ip, limit: 100, current: 150 }
);

// Validation failures
EnhancedSecurityLogger.logValidationFailure(
  correlationId,
  ['Invalid email format', 'Missing required field'],
  { ip, path, method }
);
```

## Error Handling

Comprehensive error logging with automatic categorization:

```typescript
// Application errors
log.error('Campaign execution failed', {
  component: 'campaign_executor',
  operation: 'execute_campaign',
  error: executionError,
  campaignId: 'camp_123',
  severity: 'high'
});

// Database errors
log.database('Transaction rollback', {
  operation: 'transaction',
  table: 'multiple',
  error: dbError,
  duration: 500
});
```

## Best Practices

### 1. Use Appropriate Log Levels

- **Debug**: Detailed development information
- **Info**: General application flow
- **Warn**: Potentially harmful situations
- **Error**: Error events that allow app to continue
- **Security**: Security-relevant events

### 2. Include Context

Always provide meaningful context:

```typescript
// Good
log.info('Campaign created successfully', {
  component: 'campaign_service',
  operation: 'create_campaign',
  campaignId: newCampaign.id,
  userId: req.user.id,
  campaignType: 'email',
  duration: 150
});

// Bad
log.info('Campaign created');
```

### 3. Use Correlation IDs

Always use request-scoped loggers for HTTP requests:

```typescript
// In route handlers
const requestLogger = log.fromRequest(req);
requestLogger.info('Processing request');
```

### 4. Sanitize Sensitive Data

The logging system automatically removes sensitive fields:

- Passwords
- API keys
- Tokens
- Credit card numbers
- SSNs

### 5. Performance Considerations

- Log levels are filtered at runtime
- Structured logging has minimal performance impact
- Use async logging in production
- Monitor log file sizes

## Migration from console.log

Replace `console.log` statements with structured logging:

```typescript
// Before
console.log('User created:', user.id);
console.error('Database error:', error);

// After
log.info('User created successfully', {
  component: 'user_service',
  operation: 'create_user',
  userId: user.id
});

log.error('Database connection failed', {
  component: 'database',
  operation: 'user_creation',
  error,
  severity: 'high'
});
```

## Log Analysis

### Finding Issues

```bash
# Search for errors in the last hour
grep '"level":"error"' logs/application-$(date +%Y-%m-%d).log | \
  jq 'select(.timestamp > "'$(date -d '1 hour ago' -Iseconds)'")'

# Track request by correlation ID
grep '"correlationId":"req_abc123"' logs/application-*.log

# Monitor security events
tail -f logs/security-$(date +%Y-%m-%d).log | jq .
```

### Performance Analysis

```bash
# Find slow requests (>5 seconds)
grep '"duration"' logs/application-*.log | \
  jq 'select(.duration > 5000)'

# Error rate analysis
grep '"level":"error"' logs/application-$(date +%Y-%m-%d).log | wc -l
```

## Production Considerations

### Log Retention

- Application logs: 30 days
- Error logs: 90 days
- Security logs: 365 days
- Debug logs: 7 days (dev only)

### Performance Impact

- JSON logging adds ~2-5ms per request
- Log rotation happens automatically
- Async file writes prevent blocking
- Memory usage: <50MB for log buffers

### Monitoring Integration

The logging system integrates with:

- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- Datadog
- New Relic
- CloudWatch

### Alerting

Set up alerts for:

- Error rate spikes
- Critical security events
- Performance degradation
- Service failures

## Troubleshooting

### Common Issues

1. **Logs not appearing**: Check LOG_LEVEL environment variable
2. **Performance issues**: Ensure async logging is enabled
3. **Missing correlation IDs**: Verify middleware is installed first
4. **Security logs missing**: Check SECURITY_LOG_ENABLED setting

### Debug Mode

Enable debug logging temporarily:

```bash
LOG_LEVEL=debug npm start
```

### Log File Permissions

Ensure the application can write to the logs directory:

```bash
mkdir -p logs
chmod 755 logs
```

## Support

For logging-related issues:

1. Check the logs directory permissions
2. Verify environment variables
3. Review middleware installation order
4. Monitor system resources

## Examples

See the `/server/logging/` directory for implementation examples and the test files in `/tests/` for usage patterns.