-- Migration: 0004_performance_indexes
-- Purpose: Add critical indexes for performance optimization
-- Safe to run multiple times (uses IF NOT EXISTS pattern)

-- Index on clients.domain for branding lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_domain ON clients(domain);

-- Index on users.username for authentication
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username ON users(username);

-- Index on users.client_id for multi-tenant queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_client_id ON users(client_id);

-- Index on campaigns.client_id for multi-tenant queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id);

-- Index on campaigns.status for filtering active/draft campaigns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- Index on campaigns.next_execution for scheduler queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_next_execution ON campaigns(next_execution) WHERE next_execution IS NOT NULL;

-- Index on campaigns.is_active for active campaign queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_is_active ON campaigns(is_active) WHERE is_active = true;

-- Index on campaigns.created_at for ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);

-- Index on leads.email for email lookup and deduplication
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_email ON leads(email);

-- Index on leads.phone for SMS integration
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_phone ON leads(phone) WHERE phone IS NOT NULL;

-- Index on leads.campaign_id for campaign-specific lead queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);

-- Index on leads.client_id for multi-tenant queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_client_id ON leads(client_id);

-- Index on leads.status for lead pipeline queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_status ON leads(status);

-- Index on leads.created_at for chronological queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Composite index for lead queries by campaign and status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_campaign_status ON leads(campaign_id, status);

-- Index on conversations.campaign_id for campaign analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_campaign_id ON conversations(campaign_id);

-- Index on conversations.lead_id for lead conversation lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_lead_id ON conversations(lead_id);

-- Index on conversations.user_id for user conversation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);

-- Index on conversations.status for active conversation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_status ON conversations(status);

-- Index on conversations.priority for priority-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_priority ON conversations(priority);

-- Index on conversations.updated_at for chronological ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

-- Index on conversation_messages.conversation_id for message retrieval
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);

-- Index on conversation_messages.sender_id for sender-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_messages_sender_id ON conversation_messages(sender_id);

-- Index on conversation_messages.created_at for chronological ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(created_at DESC);

-- Composite index for retrieving conversation messages chronologically
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_messages_conv_created ON conversation_messages(conversation_id, created_at DESC);

-- Index on ai_agent_config.is_active for finding active config
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_agent_config_active ON ai_agent_config(is_active) WHERE is_active = true;

-- Index on ai_agent_config.client_id for multi-tenant queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_agent_config_client_id ON ai_agent_config(client_id);

-- Index on ai_agent_config.created_at for ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_agent_config_created_at ON ai_agent_config(created_at DESC);

-- End of migration