import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from '../storage';
// Minimal prompting: avoid AutomotivePromptService to eliminate layered behavior
import { MemoryMapper } from '../integrations/supermemory';
import { searchForLeadSignals } from '../integrations/supermemory';
import { getCampaignChatContext } from './memory-orchestrator';

interface LiveConnection {
  ws: WebSocket;
  leadId: string;
  conversationId: string;
  lastActivity: Date;
}

interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  messageType: 'text' | 'email';
  content: string;
  timestamp: Date;
  isFromAI?: 0 | 1;
}

export class LiveConversationService {
  private wss: WebSocketServer;
  private connections = new Map<string, LiveConnection>();
  private aiResponseQueue = new Map<string, NodeJS.Timeout>();

  constructor(server: Server) {
    // Create WebSocket server on /ws path to avoid conflicts with Vite HMR
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws/conversations'
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.startHeartbeat();
  }

  private handleConnection(ws: WebSocket, req: any) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const leadId = url.searchParams.get('leadId');
    const conversationId = url.searchParams.get('conversationId');

    if (!leadId || !conversationId) {
      ws.close(4000, 'Missing leadId or conversationId');
      return;
    }

    const connectionId = `${leadId}-${conversationId}`;
    const connection: LiveConnection = {
      ws,
      leadId,
      conversationId,
      lastActivity: new Date()
    };

    this.connections.set(connectionId, connection);

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleIncomingMessage(connection, message);
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format' 
        }));
      }
    });

    ws.on('close', () => {
      this.connections.delete(connectionId);
      // Clear any pending AI responses
      if (this.aiResponseQueue.has(conversationId)) {
        clearTimeout(this.aiResponseQueue.get(conversationId));
        this.aiResponseQueue.delete(conversationId);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Send connection confirmation
    ws.send(JSON.stringify({
      type: 'connected',
      leadId,
      conversationId,
      timestamp: new Date().toISOString()
    }));
  }

  private async handleIncomingMessage(connection: LiveConnection, message: any) {
    const { leadId, conversationId, ws } = connection;
    
    // Update last activity
    connection.lastActivity = new Date();

    // Save message to database
    const messageRecord = await storage.createConversationMessage({
      conversationId,
      senderId: leadId,
      messageType: 'text',
      content: message.content,
      isFromAI: 0
    });

    // Fire-and-forget memory write for inbound lead message
    (async () => {
      try {
        const lead = await storage.getLead(leadId);
        await MemoryMapper.writeLeadMessage({
          type: 'lead_msg',
          clientId: lead?.clientId || 'default',
          campaignId: (lead?.campaignId || undefined) as string | undefined,
          leadEmail: lead?.email,
          content: message.content,
          meta: { conversationId, ts: Date.now() }
        });
      } catch {}
    })();

    // Broadcast to other connected agents/admins - add timestamp for ConversationMessage interface
    const messageWithTimestamp = {
      ...messageRecord,
      timestamp: messageRecord.createdAt
    };
    this.broadcastToAgents(conversationId, {
      type: 'new_message',
      message: messageWithTimestamp
    });

    // Trigger AI response if enabled
    // messageRecord is a DB record lacking 'timestamp'; we wrapped it when broadcasting.
    // For AI generation, we only need the DB record shape.
    await this.generateAIResponse(connection, messageRecord as any);
  }

  private async generateAIResponse(connection: LiveConnection, incomingMessage: ConversationMessage) {
    const { conversationId, leadId } = connection;

    // Clear any existing AI response timer
    if (this.aiResponseQueue.has(conversationId)) {
      clearTimeout(this.aiResponseQueue.get(conversationId));
    }

    // Set delay for AI response (simulate thinking time)
    const responseDelay = Math.random() * 3000 + 1000; // 1-4 seconds

    const timer = setTimeout(async () => {
      try {
        // Get lead and conversation context
        const lead = await storage.getLead(leadId);
        const conversation = await storage.getConversation(conversationId);
        const recentMessages = await storage.getConversationMessages(conversationId, 10);

        if (!lead || !conversation) {
          console.error('Lead or conversation not found for AI response');
          return;
        }

        // Historical lead intent cues retrieval (RAG) + previous campaign context (if campaign known)
        let leadSignalsSnippet = '';
        try {
          if (lead.email) {
            const leadHash = MemoryMapper.hashEmail(lead.email);
            const signals = await searchForLeadSignals({ clientId: lead.clientId || 'default', leadEmailHash: leadHash });
            if (signals.results?.length) {
              leadSignalsSnippet = signals.results.slice(0,2).map((r:any)=> (r.metadata?.title? r.metadata.title+': ':'') + (r.content||'').toString().slice(0,120) + ((r.content||'').length>120?'…':'')).join('\n');
            }
          }
        } catch {}

        // Opportunistically reuse campaign orchestrator if this lead is tied to a campaign
        let campaignHints = '';
    if (lead.campaignId) {
          try {
            const { ragContext, optimizationHints } = await getCampaignChatContext({
              clientId: lead.clientId || 'default',
      campaignId: lead.campaignId || undefined,
      userTurn: incomingMessage.content,
      context: undefined,
      goals: undefined,
              vehicleKeywords: []
            });
            campaignHints = [ragContext, optimizationHints].filter(Boolean).join('\n');
          } catch {}
        }

        // Minimal system prompt — no location or directions
        const systemPrompt = [
          'You write short, human chat replies for a car shopper.',
          'Do NOT mention or imply physical location, distance, directions, addresses, or an invitation to visit.',
          'Avoid location talk entirely — if they ask, say you can get a teammate to confirm details.',
          'Keep to 1–3 sentences, under 80 words. Ask at most one question.',
          'Focus only on the user’s last message; be natural and specific.'
        ].join('\n');

        // Generate AI response (this would use OpenRouter API)
        const aiResponseRaw = await this.callAIService(systemPrompt, incomingMessage.content, undefined as any);
        const { sanitizeAutomotiveReply } = await import('./reply-sanitizer.js');
        const aiResponse = aiResponseRaw ? sanitizeAutomotiveReply(aiResponseRaw) : null;

        if (aiResponse) {
          // Save AI response to database
          const aiMessage = await storage.createConversationMessage({
            conversationId,
            senderId: 'ai-agent',
            messageType: 'text',
            content: aiResponse,
            isFromAI: 1
          });

          // Memory write for AI response (handover / sales intelligence)
          (async () => {
            try {
              await MemoryMapper.writeHandoverEvent({
                type: 'handover_event',
                clientId: lead.clientId || 'default',
                campaignId: (lead.campaignId || undefined) as string | undefined,
                leadEmail: lead.email,
                content: aiResponse,
                meta: { conversationId, role: 'ai_response', ts: Date.now() }
              });
            } catch {}
          })();

          // Send AI response to lead
          if (connection.ws.readyState === WebSocket.OPEN) {
            connection.ws.send(JSON.stringify({
              type: 'ai_response',
              message: aiMessage
            }));
          }

          // Broadcast to agents
          this.broadcastToAgents(conversationId, {
            type: 'ai_response',
            message: aiMessage
          });
        }

      } catch (error) {
        console.error('AI response generation error:', error);
      } finally {
        this.aiResponseQueue.delete(conversationId);
      }
    }, responseDelay);

    this.aiResponseQueue.set(conversationId, timer);
  }

  private async callAIService(systemPrompt: string, userMessage: string, context: any): Promise<string | null> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Title': 'OneKeel Swarm - Live Conversations'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 200, // Shorter responses for real-time chat
          temperature: 0.8, // Slightly more conversational
          top_p: 0.9
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (error) {
      console.error('OpenRouter API call error:', error);
      return null;
    }
  }

  private broadcastToAgents(conversationId: string, data: any) {
    // Find all agent connections for this conversation - fix Map iteration issue
    this.connections.forEach((connection, connectionId) => {
      if (connection.conversationId === conversationId && 
          connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify(data));
      }
    });
  }

  private getCurrentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  private extractBrandFromMessage(message: string, vehicleInterest?: string): string | undefined {
    const content = (message + ' ' + (vehicleInterest || '')).toLowerCase();
    const brands = ['honda', 'toyota', 'ford', 'chevrolet', 'jeep', 'bmw', 'mercedes', 'audi'];
    
    for (const brand of brands) {
      if (content.includes(brand)) {
        return brand;
      }
    }
    return undefined;
  }

  private startHeartbeat() {
    setInterval(() => {
      const now = new Date();
      // Fix Map iteration issue
      this.connections.forEach((connection, connectionId) => {
        // Remove stale connections (no activity for 30 minutes)
        if (now.getTime() - connection.lastActivity.getTime() > 30 * 60 * 1000) {
          connection.ws.close();
          this.connections.delete(connectionId);
        } else if (connection.ws.readyState === WebSocket.OPEN) {
          // Send ping
          connection.ws.ping();
        }
      });
    }, 60000); // Every minute
  }

  // Public method to send message programmatically
  async sendMessageToLead(leadId: string, conversationId: string, message: string, messageType: 'text' | 'email' = 'text', isFromAI: 0 | 1 = 0) {
    const connectionId = `${leadId}-${conversationId}`;
    const connection = this.connections.get(connectionId);

    // Save to database
    const messageRecord = await storage.createConversationMessage({
      conversationId,
      senderId: isFromAI === 0 ? 'human-agent' : 'ai-agent',
      messageType,
      isFromAI,
      content: message
    });

    // Send via WebSocket if connected
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify({
        type: 'agent_message',
        message: messageRecord
      }));
    }

    return messageRecord;
  }
}

export let liveConversationService: LiveConversationService | null = null;

export function initializeLiveConversations(server: Server) {
  liveConversationService = new LiveConversationService(server);
  return liveConversationService;
}
