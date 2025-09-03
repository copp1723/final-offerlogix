#!/bin/bash

# Test setup script for MailMind application
# This script sets up the testing environment

set -e

echo "🧪 Setting up MailMind test environment..."

# Check if required tools are installed
check_dependencies() {
    echo "📋 Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo "❌ npm is not installed. Please install npm and try again."
        exit 1
    fi
    
    if ! command -v psql &> /dev/null; then
        echo "⚠️  PostgreSQL CLI (psql) is not installed. Database tests may fail."
        echo "   Please install PostgreSQL or ensure it's in your PATH."
    fi
    
    echo "✅ Dependencies check completed"
}

# Install test dependencies
install_dependencies() {
    echo "📦 Installing test dependencies..."
    npm ci
    
    # Install Playwright browsers for E2E tests
    if command -v npx &> /dev/null; then
        echo "🎭 Installing Playwright browsers..."
        npx playwright install
    else
        echo "⚠️  Could not install Playwright browsers. E2E tests may fail."
    fi
    
    echo "✅ Dependencies installed"
}

# Setup test database
setup_test_database() {
    echo "🗄️  Setting up test database..."
    
    # Check if DATABASE_URL is set for testing
    if [ -z "$TEST_DATABASE_URL" ] && [ -z "$DATABASE_URL" ]; then
        echo "⚠️  No test database URL configured."
        echo "   Set TEST_DATABASE_URL or DATABASE_URL environment variable."
        echo "   Example: export TEST_DATABASE_URL='postgresql://user:password@localhost:5432/mailmind_test'"
        return 1
    fi
    
    # Use test database URL if available, otherwise use regular DATABASE_URL
    DB_URL="${TEST_DATABASE_URL:-$DATABASE_URL}"
    
    if [ -n "$DB_URL" ]; then
        echo "   Using database: $DB_URL"
        
        # Check if database is accessible
        if command -v psql &> /dev/null; then
            if psql "$DB_URL" -c "SELECT 1;" &> /dev/null; then
                echo "✅ Database connection successful"
                
                # Run database migrations for testing
                if [ -f "drizzle.config.ts" ]; then
                    echo "   Running database migrations..."
                    npx drizzle-kit push --config=drizzle.config.ts || true
                fi
            else
                echo "❌ Could not connect to test database"
                echo "   Please ensure your database is running and accessible"
                return 1
            fi
        fi
    fi
}

# Create test configuration files
setup_test_config() {
    echo "⚙️  Setting up test configuration..."
    
    # Create .env.test if it doesn't exist
    if [ ! -f ".env.test" ]; then
        echo "   Creating .env.test file..."
        cat > .env.test << EOF
# Test environment configuration
NODE_ENV=test
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/mailmind_test
MOCK_EXTERNAL_APIS=true
MOCK_EMAIL_SERVICE=true
DISABLE_RATE_LIMITING=true
JWT_SECRET=test-jwt-secret
OPENAI_API_KEY=test-openai-key
MAILGUN_API_KEY=test-mailgun-key
EOF
        echo "   Created .env.test with default test configuration"
    else
        echo "   .env.test already exists"
    fi
    
    # Ensure test directories exist
    mkdir -p tests/{unit,integration,e2e,fixtures,utils}
    mkdir -p coverage
    mkdir -p test-results
    
    echo "✅ Test configuration completed"
}

# Validate test setup
validate_setup() {
    echo "🔍 Validating test setup..."
    
    # Check if Jest config exists
    if [ -f "jest.config.js" ]; then
        echo "✅ Jest configuration found"
    else
        echo "❌ Jest configuration missing"
        return 1
    fi
    
    # Check if test files exist
    test_files=$(find tests -name "*.test.ts" 2>/dev/null | wc -l)
    if [ "$test_files" -gt 0 ]; then
        echo "✅ Found $test_files test files"
    else
        echo "❌ No test files found"
        return 1
    fi
    
    # Verify TypeScript compilation
    echo "   Checking TypeScript compilation..."
    if npm run check; then
        echo "✅ TypeScript compilation successful"
    else
        echo "❌ TypeScript compilation failed"
        return 1
    fi
    
    echo "✅ Test setup validation completed"
}

# Run a quick test to verify everything works
run_quick_test() {
    echo "🚀 Running quick test verification..."
    
    # Run a subset of tests to verify setup
    if npm run test:unit -- --testNamePattern="should" --maxWorkers=1 --bail; then
        echo "✅ Quick test verification passed"
    else
        echo "⚠️  Some tests failed. This might be expected if external services are not available."
        echo "   Run 'npm test' to see detailed test results."
    fi
}

# Print helpful information
print_info() {
    echo ""
    echo "🎉 Test setup completed successfully!"
    echo ""
    echo "📖 Available test commands:"
    echo "   npm test                 - Run all tests"
    echo "   npm run test:unit        - Run unit tests only"
    echo "   npm run test:integration - Run integration tests only"
    echo "   npm run test:e2e         - Run end-to-end tests only"
    echo "   npm run test:watch       - Run tests in watch mode"
    echo "   npm run test:coverage    - Run tests with coverage report"
    echo ""
    echo "🔧 Useful debugging commands:"
    echo "   npm run test:ci          - Run tests in CI mode"
    echo "   npm run lint             - Check code style"
    echo "   npm run check            - Type check TypeScript"
    echo ""
    echo "📁 Test files are located in:"
    echo "   tests/unit/              - Unit tests"
    echo "   tests/integration/       - Integration tests"
    echo "   tests/e2e/              - End-to-end tests"
    echo "   tests/fixtures/         - Test data and fixtures"
    echo "   tests/utils/            - Test utilities and helpers"
    echo ""
    
    if [ -f ".env.test" ]; then
        echo "⚙️  Test configuration: .env.test"
        echo "   You can modify this file to customize test environment settings."
        echo ""
    fi
}

# Main execution
main() {
    check_dependencies
    install_dependencies
    setup_test_config
    setup_test_database
    validate_setup
    run_quick_test
    print_info
}

# Handle script arguments
case "${1:-setup}" in
    "setup"|"")
        main
        ;;
    "deps"|"dependencies")
        check_dependencies
        install_dependencies
        ;;
    "config")
        setup_test_config
        ;;
    "db"|"database")
        setup_test_database
        ;;
    "validate")
        validate_setup
        ;;
    "test")
        run_quick_test
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  setup (default)  - Full test environment setup"
        echo "  deps            - Install dependencies only"
        echo "  config          - Setup configuration files only"
        echo "  db              - Setup test database only"
        echo "  validate        - Validate test setup"
        echo "  test            - Run quick test verification"
        echo "  help            - Show this help message"
        ;;
    *)
        echo "Unknown command: $1"
        echo "Run '$0 help' for usage information."
        exit 1
        ;;
esac