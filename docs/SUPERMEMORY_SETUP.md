# Supermemory Integration Setup

Supermemory provides AI-powered memory and retrieval capabilities for MailMind, enabling:

- **Campaign Memory**: Store and recall successful campaign strategies
- **Lead Context**: Maintain conversation history and lead insights
- **AI Optimization**: Use historical data to optimize new campaigns
- **Smart Search**: Find relevant information across all stored data

## Quick Setup

### 1. Automated Setup (Recommended)

Run the interactive setup script:

```bash
npm run setup:supermemory
```

This will:
- Guide you through getting your API key
- Test the connection
- Update your `.env` file automatically

### 2. Manual Setup

#### Get Your API Key

1. Visit [Supermemory.ai](https://supermemory.ai)
2. Sign up or log in to your account
3. Navigate to API settings
4. Generate a new API key

#### Configure Environment Variables

Add these to your `.env` file:

```bash
# Supermemory Integration (RAG / Memory System)
SUPERMEMORY_API_KEY=your-supermemory-api-key-here
SUPERMEMORY_BASE_URL=https://api.supermemory.ai
SUPERMEMORY_RAG=on
SUPERMEMORY_TIMEOUT_MS=8000
SUPERMEMORY_MAX_RETRIES=3
```

#### Test Your Configuration

```bash
npm run test:supermemory
```

## Configuration Options

### Required Settings

- `SUPERMEMORY_API_KEY`: Your Supermemory API key
- `SUPERMEMORY_RAG`: Set to `on` to enable RAG features

### Optional Settings

- `SUPERMEMORY_BASE_URL`: API endpoint (default: https://api.supermemory.ai)
- `SUPERMEMORY_TIMEOUT_MS`: Request timeout in milliseconds (default: 8000)
- `SUPERMEMORY_MAX_RETRIES`: Number of retry attempts (default: 3)
- `SUPERMEMORY_RETRY_BASE_MS`: Base retry delay (default: 200)
- `SUPERMEMORY_CIRCUIT_FAILS`: Circuit breaker failure threshold (default: 4)
- `SUPERMEMORY_CIRCUIT_COOLDOWN_MS`: Circuit breaker cooldown (default: 30000)
- `SUPERMEMORY_MAX_CONTENT_BYTES`: Maximum content size (default: 200000)

## Features Enabled

Once configured, Supermemory enables these features:

### Campaign Intelligence
- **Memory Storage**: Automatically stores campaign data, templates, and performance metrics
- **Context Retrieval**: Finds similar successful campaigns for optimization
- **Pattern Recognition**: Identifies what works for specific audiences

### Lead Management
- **Conversation History**: Maintains complete lead interaction history
- **Behavioral Insights**: Tracks lead engagement patterns
- **Scoring Enhancement**: Uses historical data to improve lead scoring

### AI-Powered Optimization
- **Smart Suggestions**: Provides campaign recommendations based on historical success
- **Content Optimization**: Suggests improvements based on similar campaigns
- **Timing Optimization**: Recommends optimal send times based on past performance

## Troubleshooting

### Common Issues

#### "Supermemory integration disabled"
- Check that `SUPERMEMORY_API_KEY` is set in your `.env` file
- Verify the API key is valid and active
- Run `npm run setup:supermemory` to reconfigure

#### "Connection failed" or timeout errors
- Check your internet connection
- Verify the `SUPERMEMORY_BASE_URL` is correct
- Try increasing `SUPERMEMORY_TIMEOUT_MS`

#### "Circuit breaker open" messages
- This is a protective measure after repeated failures
- Wait for the cooldown period (default: 30 seconds)
- Check your API key and network connectivity

### Testing

Run the test suite to verify everything is working:

```bash
npm run test:supermemory
```

This will:
- Verify your API key is valid
- Test memory storage and retrieval
- Check advanced search functionality
- Validate circuit breaker behavior

### Logs

Check server logs for Supermemory status:
- ✅ "Supermemory integration enabled" - Working correctly
- ⚠️ "Supermemory integration disabled" - Not configured
- ❌ Error messages - Check configuration and connectivity

## Support

If you encounter issues:

1. Run the test script: `npm run test:supermemory`
2. Check the server logs for error messages
3. Verify your Supermemory account status
4. Try the setup script again: `npm run setup:supermemory`

For additional help, consult the [Supermemory documentation](https://docs.supermemory.ai) or contact support.
