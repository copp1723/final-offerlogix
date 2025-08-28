import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { storage } from '../storage';

interface ClientConnection {
  ws: WebSocket;
  userId?: string;
  conversationId?: string;
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
      this.clients.set(clientId, { ws });

      console.log(`WebSocket client connected: ${clientId}`);

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(clientId, message);
        } catch (error) {
          console.error('WebSocket message error:', error);
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        console.log(`WebSocket client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
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
      case 'join_conversation':
        await this.handleJoinConversation(clientId, message.conversationId, message.userId);
        break;
      case 'send_message':
        await this.handleSendMessage(clientId, message);
        break;
      case 'ping':
        client.ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
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
      console.error('Error loading conversation history:', error);
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
      console.error('Error sending message:', error);
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to send message'
      }));
    }
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