# MailMind

[![CI](https://github.com/joshcopp/MailMind/actions/workflows/ci.yml/badge.svg)](https://github.com/joshcopp/MailMind/actions/workflows/ci.yml)

AI-powered email campaign platform with intelligent conversation management and automated lead engagement.

## Features

### 🤖 AI Agent System
- **Per-Campaign AI Agents**: Assign different AI agents to each campaign for specialized responses
- **Agent Email Domains**: Configure Mailgun subdomains per agent for professional sending
- **Preview as Agent**: Test how agents will respond before campaign launch
- **Conversational Intelligence**: Natural language campaign creation and management

### 📧 Campaign Management
- **Template System**: Create and preserve email body content with dynamic personalization
- **One-Shot Specifications**: AI detects specifications and formats bulleted summaries
- **Inline Template Preview**: Review templates without leaving the workflow
- **Campaign Chat**: Interactive AI assistant for campaign optimization

### 🔄 Automated Workflows
- **Lead Handover**: Automatic alerts to sales teams when leads require human attention
- **Response Management**: Intelligent routing and response generation
- **Deliverability Controls**: Mailgun integration with domain verification

### 📊 Analytics & Monitoring
- **Campaign Performance**: Track open rates, responses, and conversions
- **Agent Activity**: Monitor AI agent interactions and effectiveness
- **Lead Scoring**: Intelligent prioritization based on engagement

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: OpenRouter API (GPT-4o and other models)
- **Email**: Mailgun API
- **Memory System**: Supermemory for persistent context
- **Styling**: Tailwind CSS + shadcn/ui components

## Environment Variables

- `SKIP_AUTH` — when set to `true` in development or test environments, API routes under `/api/ai` can be accessed without authentication. This flag is ignored in production where standard authentication is always enforced.

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Mailgun account with verified domain
- OpenRouter API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/mailmind.git
cd mailmind
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Configure the following in your `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `OPENROUTER_API_KEY` - Your OpenRouter API key
- `MAILGUN_API_KEY` - Your Mailgun API key
- `MAILGUN_DOMAIN` - Your verified Mailgun domain
- `DEFAULT_SEND_WINDOW` - Optional JSON string specifying global business hours
  (e.g. `{\"tz\":\"America/Chicago\",\"start\":\"08:00\",\"end\":\"19:00\"}`). Campaigns may override with `sendWindow`.
- Additional agent-specific domains as needed

4. Initialize the database:
```bash
npm run db:push
npm run db:sql
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Run production server
- `npm run typecheck` - TypeScript type checking for client, shared, and server
- `npm run db:push` - Push database schema changes
- `npm run db:doctor` - Database health check and repairs

### Server Typecheck Gotchas

- Server code is checked separately with `tsconfig.server.json` using Node's `nodenext` module system.
- Run `npm run typecheck` before committing to validate client, shared, and server code.
- When running node scripts locally, use `ts-node --project tsconfig.server.json` to match runtime settings.

### Linting, Types, and Tests

Run the following commands to validate code quality:

```bash
npm run lint
npm run typecheck
npm test
```

### Project Structure

```
mailmind/
├── client/           # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── lib/
├── server/           # Express backend
│   ├── routes.ts
│   ├── services/
│   │   ├── campaign-chat.ts
│   │   ├── handover-service.ts
│   │   └── ...
│   └── db/
├── shared/           # Shared types and schemas
│   └── schema.ts
├── docs/            # Documentation
├── db/              # Database migrations and seeds
│   ├── migrations/
│   └── seeds/
└── drizzle/         # Database migrations
```

## Testing Webhooks Locally

Use the Mailgun signing harness to generate webhook payloads with valid HMAC signatures. The script outputs headers and body for a `curl` request.

```bash
npx tsx scripts/mailgun-sign.ts payload.json > signed.json
curl -X POST http://localhost:3000/api/email-reliability/webhook/mailgun \
  -H "Content-Type: application/json" \
  -d @signed.json
```

Replace `payload.json` with your webhook event data. The script signs it using `MAILGUN_WEBHOOK_SIGNING_KEY` from your environment.

## Recent Updates

### Latest Features
- ✅ Per-campaign AI agent selection with UI and schema updates
- ✅ Mailgun subdomain configuration per agent
- ✅ Agent email domain as single source of truth for all sending
- ✅ One-shot specification detection with bulleted summaries
- ✅ Improved template preview system
- ✅ Enhanced chat UI with numbered/nested list rendering

## API Documentation

For detailed API documentation, see [docs/api/REST_API.md](./docs/api/REST_API.md)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues, feature requests, or questions, please open an issue on GitHub or contact the development team.

---

*MailMind - Intelligent Email Campaign Automation*