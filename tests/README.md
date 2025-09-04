# OfferLogix Testing Documentation

This directory contains comprehensive test suite for the OfferLogix application, providing confidence in code reliability and system functionality.

## 🎯 Overview

The test suite includes:
- **Unit Tests** - Test individual functions and components in isolation
- **Integration Tests** - Test API endpoints and database operations
- **End-to-End Tests** - Test complete user workflows and scenarios
- **Performance Tests** - Ensure system performs under load
- **Security Tests** - Validate input sanitization and security measures

## 📁 Directory Structure

```
tests/
├── unit/                   # Unit tests for individual services
│   ├── csv-validation.test.ts
│   ├── lead-import.test.ts
│   ├── campaign-orchestrator.test.ts
│   ├── email-validator.test.ts
│   └── ...
├── integration/            # API and database integration tests
│   ├── api-routes.test.ts
│   ├── database-operations.test.ts
│   └── ...
├── e2e/                    # End-to-end workflow tests
│   ├── campaign-workflow.test.ts
│   ├── lead-management.test.ts
│   └── ...
├── fixtures/               # Test data and sample files
│   ├── test-data.ts
│   ├── sample-csvs/
│   └── ...
├── utils/                  # Test utilities and helpers
│   ├── test-helpers.ts
│   ├── database-helpers.ts
│   └── ...
├── setup.ts               # Global test setup
├── setup-integration.ts   # Integration test setup
└── setup-e2e.ts          # E2E test setup
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL (for integration tests)
- npm or yarn package manager

### Quick Setup

1. **Run the setup script:**
   ```bash
   ./scripts/test-setup.sh
   ```

2. **Or manually install dependencies:**
   ```bash
   npm install
   npm run test
   ```

### Environment Configuration

Create a `.env.test` file (automatically created by setup script):

```env
NODE_ENV=test
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/offerlogix_test
MOCK_EXTERNAL_APIS=true
MOCK_EMAIL_SERVICE=true
DISABLE_RATE_LIMITING=true
```

## 🧪 Running Tests

### All Tests
```bash
npm test                    # Run all tests
npm run test:ci            # Run tests in CI mode
```

### By Test Type
```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e           # End-to-end tests only
```

### With Coverage
```bash
npm run test:coverage      # Generate coverage report
```

### Watch Mode
```bash
npm run test:watch         # Run tests in watch mode
```

### Specific Tests
```bash
npm test -- csv-validation              # Run specific test file
npm test -- --testNamePattern="import"  # Run tests matching pattern
```

## 📊 Coverage Goals

Our coverage targets:
- **Lines**: 80%+
- **Functions**: 80%+
- **Branches**: 80%+
- **Statements**: 80%+

Critical services should achieve 90%+ coverage:
- Lead import/export
- CSV validation
- Campaign execution
- Email services
- Authentication (when implemented)

## 🎭 Test Categories

### Unit Tests
Focus on testing individual functions and services in isolation:

- **CSV Validation Service** - File parsing, validation rules, error handling
- **Lead Import Service** - Data mapping, validation, database operations
- **Campaign Orchestrator** - Campaign execution logic, scheduling
- **Email Validator** - Email format validation, domain verification
- **Utility Functions** - Helper functions, data transformers

### Integration Tests
Test API endpoints and database interactions:

- **API Routes** - HTTP endpoints, request/response handling
- **Database Operations** - CRUD operations, data integrity
- **External Services** - Email providers, third-party APIs (mocked)
- **Authentication** - Login, permissions, session management

### End-to-End Tests
Test complete user workflows:

- **Campaign Workflow** - Create campaign → Import leads → Execute → Monitor
- **Lead Management** - Add leads → Edit → Assign to campaigns → Export
- **User Interface** - Form validation, navigation, real-time updates
- **Error Scenarios** - Network failures, validation errors, recovery

## 🛠️ Writing Tests

### Test Structure
```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should handle normal case', () => {
      // Arrange
      const input = createTestData();
      
      // Act
      const result = service.method(input);
      
      // Assert
      expect(result).toMatchObject({
        success: true,
        data: expect.any(Object)
      });
    });

    it('should handle error case', () => {
      // Test error scenarios
    });
  });
});
```

### Using Test Helpers
```typescript
import { TestDataFactory, MockStorageService } from '../utils/test-helpers';

const mockLead = TestDataFactory.createMockLead({
  email: 'test@example.com',
  status: 'new'
});
```

### Mocking External Services
```typescript
jest.mock('../../server/services/email-service', () => ({
  emailService: {
    sendEmail: jest.fn().mockResolvedValue({ success: true })
  }
}));
```

## 🔧 Test Configuration

### Jest Configuration
See `jest.config.js` for:
- Test environments (unit, integration, e2e)
- Coverage settings
- Setup files
- Module mapping

### Test Environment Variables
- `NODE_ENV=test` - Ensures test mode
- `TEST_DATABASE_URL` - Test database connection
- `MOCK_EXTERNAL_APIS=true` - Mock external services
- `DISABLE_RATE_LIMITING=true` - Disable rate limits for testing

## 📈 Continuous Integration

### GitHub Actions Workflow
Our CI pipeline runs:
1. **Dependency installation**
2. **Type checking**
3. **Linting**
4. **Unit tests**
5. **Integration tests** (with test database)
6. **E2E tests** (with browser automation)
7. **Coverage reporting**
8. **Security scanning**

### Coverage Reporting
- Reports uploaded to Codecov
- Coverage badges in README
- Fails if coverage drops below threshold

## 🐛 Debugging Tests

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check if test database is running
   psql $TEST_DATABASE_URL -c "SELECT 1;"
   
   # Reset test database
   ./scripts/test-setup.sh db
   ```

2. **Port Conflicts**
   ```bash
   # Kill processes on test ports
   lsof -ti:3001 | xargs kill -9
   ```

3. **Mock Issues**
   ```bash
   # Clear Jest cache
   npx jest --clearCache
   ```

### Debug Mode
```bash
# Run tests with debug output
DEBUG=* npm test

# Run specific test with debugging
npm test -- --verbose csv-validation.test.ts
```

## 📚 Best Practices

### 1. Test Naming
- Use descriptive test names
- Follow "should [expected behavior] when [condition]" pattern
- Group related tests with `describe` blocks

### 2. Test Data
- Use factories for consistent test data
- Avoid hardcoded values where possible
- Clean up test data after each test

### 3. Mocking
- Mock external dependencies
- Use realistic mock responses
- Reset mocks between tests

### 4. Assertions
- Use specific matchers (`toEqual`, `toContain`, etc.)
- Test both success and failure cases
- Verify side effects and state changes

### 5. Performance
- Keep tests fast (< 1 second per test)
- Use parallel execution where possible
- Mock expensive operations

## 🔍 Test Examples

### Unit Test Example
```typescript
describe('CSVValidationService', () => {
  it('should validate correct CSV format', async () => {
    const csvContent = 'email,name\ntest@example.com,John Doe';
    const buffer = Buffer.from(csvContent, 'utf8');
    
    const result = await CSVValidationService.validateCSV(buffer);
    
    expect(result.valid).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].email).toBe('test@example.com');
  });
});
```

### Integration Test Example
```typescript
describe('POST /api/leads', () => {
  it('should create a new lead', async () => {
    const leadData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com'
    };

    const response = await request(app)
      .post('/api/leads')
      .send(leadData)
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      firstName: 'John',
      email: 'john@example.com'
    });
  });
});
```

### E2E Test Example
```typescript
describe('Campaign Creation Flow', () => {
  it('should create and execute campaign', async () => {
    await page.goto('/campaigns');
    await page.click('[data-testid="create-campaign"]');
    await page.fill('[data-testid="campaign-name"]', 'Test Campaign');
    await page.click('[data-testid="save-campaign"]');
    
    await expect(page.locator('[data-testid="success-message"]'))
      .toContainText('Campaign created successfully');
  });
});
```

## 🎯 Next Steps

To further improve our testing:

1. **Add Visual Regression Tests** - Screenshot comparison for UI changes
2. **Performance Benchmarks** - Track performance metrics over time
3. **Load Testing** - Test system under realistic load
4. **Accessibility Testing** - Ensure WCAG compliance
5. **Cross-browser Testing** - Test in multiple browsers
6. **Mobile Testing** - Test responsive design and mobile interactions

## 📞 Support

For questions about testing:
1. Check this documentation
2. Review existing test examples
3. Ask the development team
4. Create an issue in the repository

## 🏆 Testing Philosophy

We believe in:
- **Test-Driven Development** - Write tests first when possible
- **Confidence over Coverage** - Quality tests over quantity
- **Fast Feedback** - Quick test execution for rapid iteration
- **Maintainable Tests** - Tests that are easy to understand and modify
- **Realistic Testing** - Tests that reflect real-world usage

Happy testing! 🚀