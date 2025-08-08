# OneKeel Swarm - Automotive Email Campaign Platform

## Overview

OneKeel Swarm is a specialized email campaign management platform designed specifically for the automotive industry. The application leverages artificial intelligence to streamline the creation of automotive-focused email campaigns, including vehicle showcases, service reminders, and test drive follow-ups. The platform features an AI Campaign Agent that generates tailored email templates and campaign goals based on minimal user input, making it easy for automotive dealerships and manufacturers to create effective marketing campaigns.

## User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Clean, professional design with minimal colors - no purple/pink, no emojis, use professional icons. Focus on simplicity over complex multi-step wizards.

## Recent Changes (August 2025)

### AI Chat Interface Revolution
- Transformed dashboard to feature conversational AI Campaign Agent as primary interface
- Implemented intelligent chat system that extracts campaign information through natural conversation
- Added step-by-step progress tracking with visual indicators
- Maintained advanced form-based campaign creation as backup option
- Simplified dashboard focus to prioritize AI-driven campaign creation

### User Role Management & Conversation System
- Added comprehensive user role system (admin, manager, user) with distinct permissions
- Implemented conversation management for customer support and communication
- Created conversation UI with real-time messaging and thread management
- Added user management interface for role assignments and permissions
- Enhanced navigation with dedicated pages for conversations and user administration

### Enhanced Production Integration
- Updated OpenRouter API integration for multiple AI model access
- Configured CORS support for production deployment at https://ccl-3-final.onrender.com
- Integrated with production Mailgun domain (mg.watchdogai.us) and Twilio SMS (+18154752252)
- Increased email template capacity to 30 templates per campaign sequence
- Successfully connected to production Render PostgreSQL database (ccl_3)

### Complete Campaign Execution & Email Validation System (August 2025)
- **PRODUCTION READY:** Implemented full campaign execution system with real Mailgun integration
- **REAL EMAIL DELIVERY:** Campaign orchestrator successfully sends emails to multiple leads in batches
- **TEMPLATE PERSONALIZATION:** Dynamic content replacement ([Name], [vehicleInterest]) working perfectly
- **AUTO-RESPONSE SYSTEM:** Enhanced email monitor sends real auto-responses via Mailgun
- **WELCOME & FOLLOW-UP:** Welcome emails and scheduled follow-ups implemented with actual email delivery
- **BATCH PROCESSING:** Configurable batch sizes with proper error handling and delay management
- **TEST MODE:** Safe testing environment for campaign validation before production sends

### Complete End-to-End Handover System & External API Integration (August 2025)
- **HANDOVER SYSTEM OPERATIONAL:** Full 2-way conversation system with buying signal detection working
- **REAL HANDOVER EVALUATION:** Successfully detecting automotive keywords, escalation phrases, and qualification scoring
- **BUYING SIGNALS:** Integrated detection for "ready to purchase", "what is the price", "schedule demo", etc.
- **ESCALATION PHRASES:** Working detection for "speak to a human", "talk to someone", "real person", etc.
- **EMAIL HANDOVER NOTIFICATIONS:** Professional branded email alerts sent to sales team with customer context
- **EXTERNAL API ENDPOINTS:** Complete webhook infrastructure for Mailgun, Twilio, and custom integrations
- **PRODUCTION WEBHOOKS:** Inbound email processing, SMS handling, campaign execution triggers operational
- **CRM INTEGRATION READY:** Full REST API suite for external system integration with leads, campaigns, conversations
- **REAL-TIME COMMUNICATION:** WebSocket server operational for live conversations and external system connectivity

### Campaign Creator Agent with Custom Handover Configuration (August 2025)
- **CONVERSATIONAL CAMPAIGN CREATION:** AI agent guides users through campaign setup via natural language
- **CUSTOM HANDOVER PROMPTS:** Users describe handover criteria in plain language ("when they ask about pricing")
- **AI CONVERSION:** System converts user's "gibberish" into structured handover prompts for campaign-specific rules
- **INTEGRATED WORKFLOW:** Handover configuration seamlessly integrated into campaign creation process
- **PERSONALIZED CRITERIA:** Each campaign can have unique handover triggers based on user's specific requirements

### Dashboard UI Improvements & Dead Button Audit (August 2025)
- Completed comprehensive UI audit to eliminate non-functional buttons
- Streamlined dashboard to focus on AI chat interface and essential insights
- Removed QuickActions and RecentCampaigns components to reduce information overload
- Added simplified Lead Scoring and AI Insights cards showing key metrics from intelligence dashboard
- Created clean 4-card layout: Active Campaigns, Engaged Leads, Handovers, Lead Scoring, and AI Insights
- Integrated real-time intelligence data including optimal send times and recommendation counts
- Enhanced Intelligence Dashboard with rich data displays showing lead scoring analytics and optimization recommendations

### OneKeel Swarm Branding & Email Infrastructure (August 2025)
- Updated platform branding from AutoCampaigns AI to OneKeel Swarm across all interfaces
- Implemented OneKeel logo integration with SVG-based branding system
- Configured dual email infrastructure: Gmail IMAP for monitoring incoming emails, Mailgun for sending campaigns
- Enhanced Mailgun integration to send emails as "OneKeel Swarm" sender identity
- Added Gmail credentials (rylieai1234@gmail.com) for automated lead processing from incoming automotive inquiries
- Maintained production Mailgun domain (mg.watchdogai.us) for all outbound campaign communications

### Automotive AI System Integration (August 2025)
- Created dual AI prompt systems: campaign creation agent and customer response agents
- Integrated Enhanced Automotive Email Marketing Campaign Expert for campaign building
- Built automotive-specific customer conversation system with handover intelligence
- Added conversation analysis for mood detection, intent recognition, and urgency assessment
- Implemented dealership-specific system prompts with compliance and escalation rules
- Created comprehensive prompt testing and generation system for automotive campaigns

### Advanced Email Response Processing System (August 2025)
- Implemented robust IMAP email monitoring service with imap-simple and mailparser libraries
- Created comprehensive EmailMonitorService with configurable trigger rules for lead creation
- Added automatic AI-powered email response generation using OpenRouter and automotive prompts
- Built email processing pipeline that extracts lead data and assigns conversations automatically
- Integrated WebSocket real-time communications for live customer conversations
- Added Email Monitor Dashboard with rule management and monitoring controls
- Implemented system auto-initialization that starts email monitoring on server startup
- Created webhook processing for Mailgun inbound emails with lead-to-conversation mapping
- Enhanced Mailgun service with bulk email capabilities and auto-response features
- Added graceful shutdown handling for all monitoring services

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens for automotive branding
- **State Management**: React Query (TanStack Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation for type-safe form management

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API endpoints for campaign management
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Database Migrations**: Drizzle Kit for schema management and migrations

### Data Storage Solutions
- **Primary Database**: PostgreSQL hosted on Render (ccl_3 database)
- **Production URL**: https://ccl-3-final.onrender.com with CORS configuration
- **Schema Design**: Campaigns table with fields for name, context, handover goals, status, AI-generated templates, subject lines, performance metrics, and email sequence configuration
- **High-Volume Support**: Supports up to 30 email templates per campaign sequence
- **Session Management**: PostgreSQL-based session storage using connect-pg-simple

### Authentication and Authorization
- **Session-based Authentication**: Server-side session management with PostgreSQL storage
- **User Management**: Basic user schema with username/password authentication
- **Security**: Password hashing and session-based access control

### AI Integration Architecture
- **AI Service Provider**: OpenRouter API (sk-or-v1-...) for accessing multiple AI models including GPT-4o
- **Production Email System**: Mailgun integration with domain mg.watchdogai.us and swarm@mg.watchdogai.us sender
- **SMS Notifications**: Twilio integration (+18154752252) for campaign alerts and notifications
- **High-Volume Capability**: EMAIL_TEMPLATE_COUNT=30 for extensive email sequence campaigns
- **Content Generation**: Specialized prompts for automotive industry content including:
  - Progressive email template sequences (up to 30 templates)
  - Vehicle showcases, service reminders, and test drive campaigns
  - Subject line optimization for automotive campaigns
  - Goal suggestion based on automotive industry KPIs
- **AI Agent Integration**: ENABLE_AGENTS=true indicates part of larger AI ecosystem
- **Contextual Processing**: AI processes campaign context to generate industry-specific content

### Component Architecture
- **Dashboard System**: Modular dashboard with QuickActions, RecentCampaigns, and QuickStats components
- **Campaign Wizard**: Multi-step modal interface with step indicators and form validation
- **AI Enhancement**: Integrated AI buttons for template generation and goal suggestions
- **Responsive Design**: Mobile-first approach with responsive breakpoints

## External Dependencies

### Core Infrastructure
- **Database**: Neon Database (PostgreSQL) for primary data storage
- **AI Services**: OpenRouter API for AI-powered content generation
- **Build Tools**: Vite for frontend bundling and development server

### UI and Styling
- **Component Library**: shadcn/ui with Radix UI primitives for accessible components
- **Styling Framework**: Tailwind CSS for utility-first styling
- **Icons**: Lucide React for consistent iconography
- **Fonts**: Google Fonts (Inter) for typography

### Development and Deployment
- **TypeScript**: For type safety across the entire application
- **ESBuild**: For server-side bundling in production
- **Replit Integration**: Development environment optimizations for Replit platform

### Form and Data Management
- **Form Validation**: Zod for runtime type checking and validation
- **HTTP Client**: Native fetch API with React Query for data fetching
- **Date Handling**: date-fns for date manipulation and formatting

### Automotive Industry Focus
- **Specialized Prompts**: Pre-configured AI prompts for automotive use cases
- **Industry Metrics**: Automotive-specific KPIs like test drive bookings and service appointments
- **Template Categories**: Vehicle showcases, service reminders, seasonal promotions, and dealership events