import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from '../storage';
import { AutomotivePromptService } from './automotive-prompts';

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
  senderType: 'lead' | 'agent' | 'ai';
  content: string;
  timestamp: Date;
  metadata?: any;
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
      senderType: 'lead' as const,
      content: message.content,
      metadata: message.metadata
    });

    // Broadcast to other connected agents/admins
    this.broadcastToAgents(conversationId, {
      type: 'new_message',
      message: messageRecord
    });

    // Trigger AI response if enabled
    await this.generateAIResponse(connection, messageRecord);
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

        // Create automotive context
        const context = AutomotivePromptService.createConversationContext(
          lead.name || 'Customer',
          lead.vehicleInterest,
          incomingMessage.content,
          recentMessages.map(m => m.content)
        );

        // Generate enhanced system prompt with conversation enhancers
        const config = AutomotivePromptService.getDefaultDealershipConfig();
        const currentSeason = this.getCurrentSeason();
        const brand = this.extractBrandFromMessage(incomingMessage.content, lead.vehicleInterest);

        const systemPrompt = AutomotivePromptService.generateEnhancedSystemPrompt(
          config,
          context,
          {
            season: currentSeason,
            brand,
            useStraightTalkingStyle: true,
            isReEngagement: recentMessages.length === 0
          }
        );

        // Generate AI response (this would use OpenRouter API)
        const aiResponse = await this.callAIService(systemPrompt, incomingMessage.content, context);

        if (aiResponse) {
          // Save AI response to database
          const aiMessage = await storage.createConversationMessage({
            conversationId,
            senderId: 'ai-agent',
            senderType: 'ai' as const,
            content: aiResponse,
            metadata: {
              systemPrompt: systemPrompt,
              context: context,
              enhancers: AutomotivePromptService.applyConversationEnhancers(context, currentSeason, brand)
            }
          });

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
    // Find all agent connections for this conversation
    for (const [connectionId, connection] of this.connections) {
      if (connection.conversationId === conversationId && 
          connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify(data));
      }
    }
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
      for (const [connectionId, connection] of this.connections) {
        // Remove stale connections (no activity for 30 minutes)
        if (now.getTime() - connection.lastActivity.getTime() > 30 * 60 * 1000) {
          connection.ws.close();
          this.connections.delete(connectionId);
        } else if (connection.ws.readyState === WebSocket.OPEN) {
          // Send ping
          connection.ws.ping();
        }
      }
    }, 60000); // Every minute
  }

  // Public method to send message programmatically
  async sendMessageToLead(leadId: string, conversationId: string, message: string, senderType: 'agent' | 'ai' = 'agent') {
    const connectionId = `${leadId}-${conversationId}`;
    const connection = this.connections.get(connectionId);

    // Save to database
    const messageRecord = await storage.createConversationMessage({
      conversationId,
      senderId: senderType === 'agent' ? 'human-agent' : 'ai-agent',
      senderType,
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