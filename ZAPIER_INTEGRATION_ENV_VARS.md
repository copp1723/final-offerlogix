# Zapier Integration Environment Variables

This document outlines the environment variables required to configure the Zapier-HubSpot integration for the OneKeel OfferLogix Swarm platform.

## Required Environment Variables

### ZAPIER_INTEGRATION_ENABLED
- **Description**: Enables or disables the Zapier integration
- **Type**: Boolean (string)
- **Required**: Yes
- **Default**: `false`
- **Example**: `ZAPIER_INTEGRATION_ENABLED=true`
- **Notes**: Set to `true` to enable the integration, `false` to disable

### ZAPIER_WEBHOOK_URL
- **Description**: The webhook URL provided by Zapier for receiving lead data
- **Type**: String (URL)
- **Required**: Yes (when integration is enabled)
- **Example**: `ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/12345/abcdef/`
- **Notes**: This URL is provided by Zapier when setting up the webhook trigger

## Optional Environment Variables

### ZAPIER_SECRET_KEY
- **Description**: Secret key for HMAC signature verification
- **Type**: String
- **Required**: No
- **Example**: `ZAPIER_SECRET_KEY=your-secret-key-here`
- **Notes**: If provided, webhooks will include an HMAC signature for verification

### ZAPIER_TIMEOUT_MS
- **Description**: Timeout for webhook requests in milliseconds
- **Type**: Integer
- **Required**: No
- **Default**: `5000` (5 seconds)
- **Example**: `ZAPIER_TIMEOUT_MS=10000`
- **Notes**: Increase if webhook endpoint is slow to respond

### ZAPIER_MAX_RETRIES
- **Description**: Maximum number of retry attempts for failed webhooks
- **Type**: Integer
- **Required**: No
- **Default**: `3`
- **Example**: `ZAPIER_MAX_RETRIES=5`
- **Notes**: Number of times to retry failed webhook deliveries

## Configuration Examples

### Development Environment
```bash
# Enable Zapier integration for testing
ZAPIER_INTEGRATION_ENABLED=true
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/12345/test123/
ZAPIER_SECRET_KEY=dev-secret-key
ZAPIER_TIMEOUT_MS=5000
ZAPIER_MAX_RETRIES=3
```

### Production Environment
```bash
# Production Zapier integration
ZAPIER_INTEGRATION_ENABLED=true
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/67890/prod456/
ZAPIER_SECRET_KEY=prod-secure-secret-key-here
ZAPIER_TIMEOUT_MS=10000
ZAPIER_MAX_RETRIES=5
```

### Disabled Integration
```bash
# Disable Zapier integration
ZAPIER_INTEGRATION_ENABLED=false
# Other variables are ignored when disabled
```

## Security Considerations

1. **Secret Key**: Always use a strong, unique secret key in production
2. **URL Protection**: Keep the webhook URL confidential
3. **Environment Isolation**: Use different webhook URLs for development and production
4. **Monitoring**: Monitor webhook delivery success rates and errors

## Webhook Payload Structure

The integration sends the following JSON payload structure to the Zapier webhook:

```json
{
  "event": "lead_created|lead_updated|lead_status_changed",
  "timestamp": "2025-09-07T15:30:00.000Z",
  "lead": {
    "id": "lead-uuid",
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+1234567890",
    "vehicleInterest": "Toyota Camry",
    "leadSource": "website",
    "status": "new",
    "notes": "Interested in test drive",
    "createdAt": "2025-09-07T15:30:00.000Z",
    "updatedAt": "2025-09-07T15:30:00.000Z"
  },
  "campaign": {
    "id": "campaign-uuid",
    "name": "Spring Promotion"
  },
  "metadata": {
    "previousStatus": "new",
    "changedFields": ["status", "notes"]
  },
  "signature": "sha256=abc123..." // Only if ZAPIER_SECRET_KEY is set
}
```

## Testing the Integration

Use the following API endpoints to test the integration:

1. **Check Status**: `GET /api/integrations/zapier/status`
2. **Test Connection**: `POST /api/integrations/zapier/test`
3. **Manual Trigger**: `POST /api/integrations/zapier/trigger`

Example test request:
```bash
curl -X POST http://localhost:3000/api/integrations/zapier/test \
  -H "Content-Type: application/json"
```

