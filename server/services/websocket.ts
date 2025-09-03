import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { storage } from '../storage';
import { createErrorContext } from '../utils/error-utils';

interface ClientConnection {
  ws: WebSocket;
  userId?: string;
  conversationId?: string;
  subscriptions: Set<string>; // Track what this client is subscribed to
  isAuthenticated: boolean;
  lastPing?: Date;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientConnection> = new Map();

  initialize(server: Server) {
    if (this.wss) {
      if (process.env.DEBUG_WS === 'true') {
        console.warn('WebSocket server already initialized. Skipping.');
      }
      return;
    }
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      perMessageDeflate: false
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, { 
        ws, 
        subscriptions: new Set(),
        isAuthenticated: false,
        lastPing: new Date()
      });

      console.log(`WebSocket client connected: ${clientId}`);

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(clientId, message);
        } catch (error) {
          console.error('WebSocket message error:', createErrorContext(error));
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        console.log(`WebSocket client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', createErrorContext(error));
        this.clients.delete(clientId);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString()
      }));
    });

    console.log('✅ WebSocket server initialized on /ws');
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async handleMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'authenticate':
        await this.handleAuthenticate(clientId, message);
        break;
      case 'join_conversation':
        await this.handleJoinConversation(clientId, message.conversationId, message.userId);
        break;
      case 'leave_conversation':
        await this.handleLeaveConversation(clientId);
        break;
      case 'subscribe_state_updates':
        await this.handleSubscribeStateUpdates(clientId, message);
        break;
      case 'unsubscribe_state_updates':
        await this.handleUnsubscribeStateUpdates(clientId, message);
        break;
      case 'send_message':
        await this.handleSendMessage(clientId, message);
        break;
      case 'ping':
        await this.handlePing(clientId);
        break;
      default:
        client.ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  }

  private async handleJoinConversation(clientId: string, conversationId: string, userId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.conversationId = conversationId;
    client.userId = userId;

    // Send conversation history
    try {
      const messages = await storage.getConversationMessages(conversationId);
      client.ws.send(JSON.stringify({
        type: 'conversation_history',
        conversationId,
        messages: messages.reverse() // Show newest first
      }));
    } catch (error) {
      console.error('Error loading conversation history:', createErrorContext(error));
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to load conversation history'
      }));
    }
  }

  private async handleSendMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client || !client.conversationId || !client.userId) {
      client?.ws.send(JSON.stringify({
        type: 'error',
        message: 'Not joined to a conversation'
      }));
      return;
    }

    try {
      // Save message to database
      const newMessage = await storage.createConversationMessage({
        conversationId: client.conversationId,
        content: message.content,
        senderId: client.userId,
        isFromAI: 0
      });

      // Broadcast to all clients in this conversation
      this.broadcastToConversation(client.conversationId, {
        type: 'new_message',
        message: newMessage
      });

    } catch (error) {
      console.error('Error sending message:', createErrorContext(error));
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to send message'
      }));
    }
  }

  // Authentication handler
  private async handleAuthenticate(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      // Validate auth token/credentials
      const { userId, token } = message;
      
      // Basic validation - in production, validate JWT token
      if (userId && token) {
        client.userId = userId;
        client.isAuthenticated = true;
        
        client.ws.send(JSON.stringify({
          type: 'authenticated',
          userId,
          timestamp: new Date().toISOString()
        }));
        
        console.log(`Client ${clientId} authenticated as user ${userId}`);
      } else {
        client.ws.send(JSON.stringify({
          type: 'auth_error',
          message: 'Invalid credentials'
        }));
      }
    } catch (error) {
      console.error('Authentication error:', createErrorContext(error));
      client.ws.send(JSON.stringify({
        type: 'auth_error',
        message: 'Authentication failed'
      }));
    }
  }

  // Leave conversation handler
  private async handleLeaveConversation(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.conversationId = undefined;
    client.ws.send(JSON.stringify({
      type: 'left_conversation',
      timestamp: new Date().toISOString()
    }));
  }

  // Subscribe to state updates
  private async handleSubscribeStateUpdates(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client || !client.isAuthenticated) {
      client?.ws.send(JSON.stringify({
        type: 'error',
        message: 'Authentication required'
      }));
      return;
    }

    const { subscriptions } = message;
    if (Array.isArray(subscriptions)) {
      subscriptions.forEach(sub => client.subscriptions.add(sub));
      
      client.ws.send(JSON.stringify({
        type: 'subscribed',
        subscriptions: Array.from(client.subscriptions),
        timestamp: new Date().toISOString()
      }));
    }
  }

  // Unsubscribe from state updates
  private async handleUnsubscribeStateUpdates(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { subscriptions } = message;
    if (Array.isArray(subscriptions)) {
      subscriptions.forEach(sub => client.subscriptions.delete(sub));
      
      client.ws.send(JSON.stringify({
        type: 'unsubscribed',
        subscriptions: Array.from(client.subscriptions),
        timestamp: new Date().toISOString()
      }));
    }
  }

  // Enhanced ping handler
  private async handlePing(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastPing = new Date();
    client.ws.send(JSON.stringify({ 
      type: 'pong', 
      timestamp: new Date().toISOString(),
      serverTime: Date.now()
    }));
  }

  // Public methods for external services
  broadcastNewLead(lead: any) {
    this.internalBroadcast({
      type: 'new_lead',
      lead
    });
  }

  broadcastNewConversation(conversation: any) {
    this.internalBroadcast({
      type: 'new_conversation',
      conversation
    });
  }

  broadcastToConversation(conversationId: string, data: any) {
    this.clients.forEach((client) => {
      if (client.conversationId === conversationId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(data));
      }
    });
  }

  broadcast(type: string, data: any) {
    const message = { type, ...data };
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  // Broadcast conversation state changes
  broadcastConversationStateChange(conversationId: string, data: any) {
    const message = {
      type: 'conversation_state_changed',
      conversationId,
      ...data,
      timestamp: new Date().toISOString()
    };

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN && 
          (client.subscriptions.has('conversation_states') || 
           client.subscriptions.has(`conversation:${conversationId}`))) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  // Broadcast lead journey updates
  broadcastLeadJourneyUpdate(leadId: string, data: any) {
    const message = {
      type: 'lead_journey_updated',
      leadId,
      ...data,
      timestamp: new Date().toISOString()
    };

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN && 
          (client.subscriptions.has('lead_journeys') || 
           client.subscriptions.has(`lead:${leadId}`))) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  // Broadcast message threading updates
  broadcastMessageThreadUpdate(conversationId: string, data: any) {
    const message = {
      type: 'message_thread_updated',
      conversationId,
      ...data,
      timestamp: new Date().toISOString()
    };

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN && 
          (client.subscriptions.has('message_threads') || 
           client.subscriptions.has(`conversation:${conversationId}`))) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  // Broadcast handover events
  broadcastHandoverEvent(conversationId: string, leadId: string, data: any) {
    const message = {
      type: 'handover_event',
      conversationId,
      leadId,
      ...data,
      timestamp: new Date().toISOString()
    };

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN && 
          (client.subscriptions.has('handover_events') || 
           client.subscriptions.has(`conversation:${conversationId}`) ||
           client.subscriptions.has(`lead:${leadId}`))) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  // Broadcast email reliability updates
  broadcastEmailEvent(conversationId: string, leadId: string, data: any) {
    const message = {
      type: 'email_event',
      conversationId,
      leadId,
      ...data,
      timestamp: new Date().toISOString()
    };

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN && 
          (client.subscriptions.has('email_events') || 
           client.subscriptions.has(`conversation:${conversationId}`) ||
           client.subscriptions.has(`lead:${leadId}`))) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  // Send targeted message to specific user
  sendToUser(userId: string, message: any) {
    this.clients.forEach((client) => {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          ...message,
          timestamp: new Date().toISOString()
        }));
      }
    });
  }

  // Send message to conversation participants
  sendToConversationParticipants(conversationId: string, message: any, excludeUserId?: string) {
    this.clients.forEach((client) => {
      if (client.conversationId === conversationId && 
          client.ws.readyState === WebSocket.OPEN &&
          client.userId !== excludeUserId) {
        client.ws.send(JSON.stringify({
          ...message,
          timestamp: new Date().toISOString()
        }));
      }
    });
  }

  private internalBroadcast(data: any) {
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(data));
      }
    });
  }

  getConnectedClients(): number {
    return this.clients.size;
  }
}

export const webSocketService = new WebSocketService();