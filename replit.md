# AutoCampaigns AI - Automotive Email Campaign Platform

## Overview

AutoCampaigns AI is a specialized email campaign management platform designed specifically for the automotive industry. The application leverages artificial intelligence to streamline the creation of automotive-focused email campaigns, including vehicle showcases, service reminders, and test drive follow-ups. The platform features an AI Campaign Agent that generates tailored email templates and campaign goals based on minimal user input, making it easy for automotive dealerships and manufacturers to create effective marketing campaigns.

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
- Implemented comprehensive OutboundEmailWatchdog for email safety validation
- Added campaign execution modal with test mode, scheduling, and follow-up capabilities
- Created lead-to-campaign assignment system with conversation tracking
- Built intelligent handover service for automotive-specific conversation analysis
- Enhanced email validation with template placeholder detection, spam prevention, and bulk send limits
- Integrated real-time email validation API endpoints and monitoring dashboard

### Automotive AI System Integration (August 2025)
- Created dual AI prompt systems: campaign creation agent and customer response agents
- Integrated Enhanced Automotive Email Marketing Campaign Expert for campaign building
- Built automotive-specific customer conversation system with handover intelligence
- Added conversation analysis for mood detection, intent recognition, and urgency assessment
- Implemented dealership-specific system prompts with compliance and escalation rules
- Created comprehensive prompt testing and generation system for automotive campaigns

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