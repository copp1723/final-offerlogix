# OfferLogix

[![CI](https://github.com/joshcopp/OfferLogix/actions/workflows/ci.yml/badge.svg)](https://github.com/joshcopp/OfferLogix/actions/workflows/ci.yml)

B2B email campaign platform with AI template generation for dealers and vendors.

## Features

### 📧 Campaign Management
- **AI Template Generation**: Automatically create personalized email templates using AI
- **Campaign Creation**: Easy-to-use campaign builder for B2B outreach
- **Lead Management**: Track and manage prospect responses
- **Send Flow**: Streamlined email sending with Mailgun integration

### 🤖 AI Integration
- **Template Generation**: POST `/api/templates/generate` endpoint for AI-powered content creation
- **OpenRouter Integration**: GPT-5-mini model for high-quality template generation
- **B2B Focused**: Templates optimized for dealer and vendor communications

### � Simple Metrics
- **Campaign Performance**: Basic open rates and response tracking
- **Lead Scoring**: Simple prioritization system
- **Dashboard**: Clean, focused interface for campaign management

### � Optional Views
- **Conversations**: Read-only transcript view of email interactions
- **Handover Queue**: Simple list of cases requiring human attention with resolve functionality

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: OpenRouter API (GPT-5-mini)
- **Email**: Mailgun API
- **Styling**: Tailwind CSS + shadcn/ui components

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Mailgun account with verified domain
- OpenRouter API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/offerlogix.git
cd offerlogix
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

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `OPENROUTER_API_KEY` - Your OpenRouter API key (for GPT-5-mini)
- `MAILGUN_API_KEY` - Your Mailgun API key
- `MAILGUN_DOMAIN` - Your verified Mailgun domain

**Removed (no longer needed):**
- SMS/Twilio integration
- Supermemory service
- Complex AI agent configurations

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
- `npm run check` - TypeScript type checking
- `npm run db:push` - Push database schema changes
- `npm run db:doctor` - Database health check and repairs

### Project Structure

```
offerlogix/
├── client/           # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── lib/
├── server/           # Express backend
│   ├── routes.ts
│   ├── services/
│   └── db/
├── shared/           # Shared types and schemas
│   └── schema.ts
├── docs/            # Documentation
└── drizzle/         # Database migrations
```

## Key Flows

### Campaign Creation → Template Generation → Send
1. Create campaign with target context
2. Click "Generate Templates" button → calls `POST /api/templates/generate`
3. Review generated templates
4. Launch campaign to send emails
5. Monitor basic metrics in dashboard

### AI Response or Handover
1. Recipients reply to campaign emails
2. AI processes responses automatically
3. Complex cases appear in Handover Queue for human review
4. Simple resolve/dismiss workflow

## Recent Updates

### Latest Changes (Part 2 - Frontend & Docs)
- ✅ Simplified UI to focus on campaign management with AI template generation
- ✅ Removed complex AI chat interfaces, SMS integration, and automotive language
- ✅ Added "Generate Templates" button calling POST /api/templates/generate
- ✅ Created read-only Conversations view for transcript review
- ✅ Added simple Handover queue with list + resolve functionality
- ✅ Updated copy to B2B dealer/vendor positioning
- ✅ Updated README: OpenRouter GPT-5-mini, Mailgun, DB; no SMS, no Supermemory

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

*OfferLogix - Intelligent Offer Management & Knowledge Base*