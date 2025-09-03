# MailMind 2.0 - Lean Conversation Engine

## 🎯 Vision
Replace the complex 50+ service architecture with **4 focused services** that deliver reliable two-way conversations with perfect email threading.

## ⚡ Architecture

```
AgentCore → ConversationEngine → MailgunThreading → CampaignSender
```

## 🏗️ Services

### 1. **AgentCore** (`/services/agent-core`)
- Agent configuration management
- System prompt rendering with variables
- OpenRouter AI integration
- Handover logic execution

### 2. **ConversationEngine** (`/services/conversation-engine`) 
- Email thread state management
- Message storage and retrieval
- Perfect email continuity
- Conversation lifecycle management

### 3. **CampaignSender** (`/services/campaign-sender`)
- Simple batch email sending
- Lead deduplication
- Campaign scheduling
- Initial email creation

### 4. **MailgunThreading** (`/services/mailgun-threading`)
- Email delivery infrastructure  
- Threading header management
- Inbound webhook processing
- Message-ID tracking

## 🗄️ Database Schema

### Core Tables
- `agents` - Agent configurations per client
- `system_prompts` - Global prompts with variable injection
- `campaigns` - Simple campaign definitions
- `conversations` - Email thread tracking
- `messages` - Individual messages with threading data

## 🚀 Deployment Strategy

**Same environment, same deployment pipeline** - just switch branches:

```bash
# Development
git checkout mailmind-v2
npm run dev:v2

# Production  
git checkout mailmind-v2  
# Same deployment process, environment variables
```

## 👥 Team Development

- **Team Member A**: Database + AgentCore
- **Team Member B**: CampaignSender + Integration  
- **Orchestrator**: ConversationEngine + MailgunThreading

## 📋 Key Simplifications

1. **Agent-first configuration** - Everything flows from agent config
2. **Perfect email threading** - Consistent From/Reply-To addresses
3. **Simple conversation flow** - Campaign → Response → [Loop] → Handover
4. **Prompt-driven handover** - Logic embedded in system prompts
5. **Zero external dependencies** - No Supermemory, IMAP, or lead scoring

## 🔄 Migration Plan

1. **Week 1-2**: Build alongside current system
2. **Week 3**: Gradual switchover (new campaigns → V2)  
3. **Week 4**: Complete migration and cleanup

---

**Goal**: Intelligent, reliable two-way conversations with perfect threading and configurable handover logic.