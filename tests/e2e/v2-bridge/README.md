# V2 Bridge E2E Testing Suite

## Overview

This directory contains comprehensive end-to-end tests for the V2 UI bridge functionality. The tests ensure that the V2 bridge works correctly, maintains isolation from V1 endpoints, and provides proper telemetry tracking.

## Test Coverage

### ✅ V2 Conversation Load Test
- **Purpose**: Verify V2 conversations load correctly and render subject & status
- **Coverage**: 
  - GET `/v2/conversations/:id` endpoint integration
  - UI rendering of conversation data
  - Status badge display for different conversation states
  - Handover badge visibility for `handed_over` status

### ✅ V2 Reply Path Test  
- **Purpose**: Test V2 reply functionality with handover detection
- **Coverage**:
  - POST `/v2/conversations/:id/reply` endpoint integration
  - Success toast notifications
  - Handover detection and toast messages
  - V1 endpoint isolation (ensures V1 endpoints are not called)

### ✅ V1 Isolation Test
- **Purpose**: Ensure V1 endpoints are used when V2 is disabled
- **Coverage**:
  - Feature flag `VITE_ENABLE_V2_UI=false` behavior
  - Agent `useV2=false` configuration handling
  - V1 endpoint usage verification
  - UI component rendering differences

### ✅ Telemetry Tracking
- **Purpose**: Verify telemetry events are properly tracked
- **Coverage**:
  - `v2_reply_sent` event tracking
  - Event data structure validation
  - Handover status inclusion in telemetry
  - Development mode logging verification

### ✅ Development Guardrails
- **Purpose**: Test debugging aids and safety measures
- **Coverage**:
  - V2 debug badge visibility in development
  - Console warning messages for unexpected behavior
  - Feature flag state debugging
  - Error handling and graceful degradation

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Ensure Playwright browsers are installed
npx playwright install
```

### Test Commands

```bash
# Run all V2 bridge tests
npm run test:v2-bridge

# Run tests with browser UI (headed mode)
npm run test:v2-bridge:headed

# Run tests in debug mode
npm run test:v2-bridge:debug

# Run specific test file
npx playwright test tests/e2e/v2-bridge/v2-bridge-playwright.spec.ts
```

### Environment Setup

The tests automatically configure the required environment:

```bash
# Environment variables set during test execution
VITE_ENABLE_V2_UI=true
NODE_ENV=test
```

## Test Architecture

### Mock Strategy
- **V2 Endpoints**: Fully mocked with realistic responses
- **Handover Detection**: Simulated based on message content
- **Telemetry**: Captured and verified through console interception
- **Feature Flags**: Controlled via localStorage and environment variables

### Test Data
- **Test Agents**: V2-enabled and V1-only agents
- **Test Conversations**: Active, handed-over, and error scenarios
- **Mock Responses**: Realistic API response structures

### Browser Coverage
- ✅ Chromium (Desktop)
- ✅ Firefox (Desktop) 
- ✅ WebKit/Safari (Desktop)
- ✅ Mobile Chrome
- ✅ Mobile Safari

## Configuration Files

- `v2-bridge-playwright.config.ts` - Playwright configuration
- `v2-bridge-setup.ts` - Global test setup
- `v2-bridge-teardown.ts` - Global test cleanup
- `v2-bridge-playwright.spec.ts` - Main test suite

## Debugging

### Development Mode Features
- **V2 Debug Badge**: Visible indicator when V2 bridge is active
- **Console Logging**: Detailed logging of V2 operations
- **Warning Messages**: Alerts for unexpected V1 endpoint usage
- **Telemetry Tracking**: Real-time event logging

### Debug Commands
```bash
# Run with browser developer tools
npm run test:v2-bridge:debug

# Run specific test with debugging
npx playwright test --debug -g "should load V2 conversation"

# Generate test report
npx playwright show-report
```

## Rollback Testing

The test suite includes scenarios for safe rollback:

1. **Feature Flag Disable**: `VITE_ENABLE_V2_UI=false`
2. **Per-Agent Disable**: `agent.useV2=false`
3. **Graceful Degradation**: V2 endpoint failures fall back to V1

## Metrics Validation

Tests verify the following metrics are tracked:

- `v2_reply_sent` - V2 reply events with handover status
- `v2_conversation_load` - V2 conversation loading events  
- `v2_handover_triggered` - Handover detection events
- `v2_bridge_activated` - V2 bridge usage events
- `v1_fallback_used` - V1 fallback scenarios

## CI/CD Integration

The tests are configured for continuous integration:

- **Parallel Execution**: Tests run in parallel for speed
- **Retry Logic**: Automatic retry on CI failures
- **Artifact Collection**: Screenshots and videos on failure
- **Report Generation**: HTML and JSON test reports

## Troubleshooting

### Common Issues

1. **Tests Timeout**: Increase `timeout` in config or check server startup
2. **Mock Failures**: Verify route patterns match actual API endpoints
3. **Feature Flag Issues**: Check localStorage and environment variable setup
4. **Telemetry Missing**: Ensure console interception is working

### Debug Steps

1. Run tests in headed mode to see browser interactions
2. Check browser console for error messages
3. Verify mock API responses in Network tab
4. Review test artifacts (screenshots/videos) for failures

## Contributing

When adding new V2 bridge functionality:

1. Add corresponding test coverage
2. Update mock responses if API changes
3. Verify telemetry events are tracked
4. Test both V2 enabled and disabled scenarios
5. Update this README with new test coverage
