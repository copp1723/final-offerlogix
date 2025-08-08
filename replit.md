# OneKeel Swarm - Automotive Email Campaign Platform

## Overview
OneKeel Swarm is an AI-powered email campaign management platform specifically designed for the automotive industry. Its primary purpose is to streamline the creation of automotive-focused email campaigns, such as vehicle showcases, service reminders, and test drive follow-ups. The platform features an AI Campaign Agent that generates tailored email templates and campaign goals based on minimal user input, enabling automotive dealerships and manufacturers to create effective marketing campaigns efficiently. The business vision is to provide a comprehensive, AI-driven solution that simplifies complex marketing tasks, offering significant market potential by empowering automotive businesses with advanced, accessible marketing tools.

## User Preferences
Preferred communication style: Simple, everyday language.
Design preferences: Clean, professional design with minimal colors - no purple/pink, no emojis, use professional icons. Focus on simplicity over complex multi-step wizards.

## System Architecture

### UI/UX Decisions
The platform features a clean, professional design prioritizing simplicity and ease of use. The dashboard is streamlined to focus on an AI chat interface as the primary mode of interaction, supplemented by essential insights. UI components are built using shadcn/ui on Radix UI primitives, styled with Tailwind CSS and custom design tokens for automotive branding. Icons are provided by Lucide React, and typography uses Google Fonts (Inter). The design adopts a mobile-first approach with responsive breakpoints.

### Technical Implementations
**Frontend:** Developed using React with TypeScript and Vite. It utilizes React Query for server state management, Wouter for lightweight routing, and React Hook Form with Zod for form handling.
**Backend:** Built with Node.js and Express.js using TypeScript. It exposes RESTful API endpoints for campaign management.
**Data Storage:** PostgreSQL (hosted on Render) is the primary database, with Drizzle ORM for type-safe operations and Drizzle Kit for schema migrations. Session management is also PostgreSQL-based.
**AI Integration:** Leverages OpenRouter API for accessing multiple AI models, including GPT-4o. It employs dual AI prompt systems for campaign creation and customer response, incorporating automotive-specific prompts for content generation, subject line optimization, and goal suggestions. A comprehensive memory system (Supermemory) uses MemoryMapper, QueryBuilder, and RAG prompts for context-aware processing, lead scoring, and optimization.
**Email and SMS:** Integrates with Mailgun for high-volume email sending (supporting up to 30 templates per campaign sequence, RFC 8058 compliant headers, SPF/DKIM/DMARC checks) and Twilio for SMS notifications. It also uses Gmail IMAP for monitoring incoming emails.
**Conversation System:** Features a 2-way conversation system with buying signal detection, escalation phrase identification, and real-time communication via WebSocket. Automated email response generation and intelligent reply planning are central to this system.
**Authentication:** Uses server-side session management with PostgreSQL storage and basic username/password authentication.

### Feature Specifications
- **AI Campaign Agent:** Conversational AI guides users through campaign setup, converting natural language input into structured campaign parameters and custom handover criteria.
- **User Role Management:** Comprehensive system with distinct permissions (admin, manager, user).
- **Campaign Execution:** Full campaign execution system with real Mailgun integration, batch processing, dynamic content replacement for personalization, and an auto-response system.
- **Handover System:** Detects buying signals and escalation phrases, sending branded email alerts to sales teams with customer context.
- **Supermemory System:** Production-ready memory architecture with debounced writes, PII redaction, structured tagging, and memory-augmented campaign chat for informed campaign creation and lead scoring.
- **Deliverability & Conversation Quality:** Implements email header compliance, domain health checks, automated suppression management, and AI-generated quick reply suggestions.
- **Dashboard:** Streamlined dashboard with a 4-card layout displaying Active Campaigns, Engaged Leads, Handovers, Lead Scoring, and AI Insights.
- **Email Response Processing:** Robust IMAP email monitoring service with AI-powered response generation and lead data extraction.

### System Design Choices
- **Modularity:** Component-based architecture for UI elements and backend services.
- **Scalability:** Designed for high-volume email campaigns with configurable batch processing and robust error handling.
- **Contextual Awareness:** AI leverages historical data and automotive-specific keywords for relevant content generation and lead engagement.
- **Extensibility:** REST API suite for CRM integration and external system connectivity.

## Documentation Suite (January 2025) - COMPREHENSIVE
- **COMPLETE DOCUMENTATION SYSTEM:** Comprehensive docs covering all platform aspects from onboarding to advanced API usage
- **ONBOARDING GUIDE:** Step-by-step setup process with environment configuration, brand setup, lead import, and first campaign creation
- **PLATFORM OVERVIEW:** Detailed explanation of AI-first architecture, key features, business benefits, and competitive advantages
- **FEATURE DOCUMENTATION:** In-depth guides for AI Campaign Agent, Conversation Intelligence, Deliverability Controls, and Supermemory integration
- **API REFERENCE:** Complete REST API documentation with authentication, endpoints, SDKs, webhooks, and best practices
- **WORKFLOW GUIDES:** End-to-end campaign creation process, optimization strategies, and troubleshooting procedures
- **ADMIN CONFIGURATION:** System setup, security configuration, white-label deployment, and performance optimization
- **QUICK START GUIDE:** 5-minute campaign creation tutorial for immediate platform value demonstration

## External Dependencies

### Core Infrastructure
- **Database:** Neon Database (PostgreSQL)
- **AI Services:** OpenRouter API
- **Email Service:** Mailgun
- **SMS Service:** Twilio
- **Frontend Build Tool:** Vite

### UI and Styling
- **Component Library:** shadcn/ui, Radix UI
- **Styling Framework:** Tailwind CSS
- **Icons:** Lucide React
- **Fonts:** Google Fonts (Inter)

### Development and Deployment
- **Language:** TypeScript
- **Server-side Bundler:** ESBuild
- **Date Handling:** date-fns

### Form and Data Management
- **Form Validation:** Zod
- **Data Fetching:** React Query (TanStack Query)