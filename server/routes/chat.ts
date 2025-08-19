import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { campaigns, conversations, conversationMessages, leads } from "@shared/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { processCampaignChat } from "../services/ai-chat";

const router = Router();

// Schema for chat session initialization
const initSessionSchema = z.object({
  visitorId: z.string(),
  pageUrl: z.string().url(),
  referrer: z.string().optional(),
  campaignId: z.string(),
  metadata: z.object({
    userAgent: z.string(),
    timestamp: z.number(),
  }).optional(),
});

// Schema for chat messages
const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  sessionToken: z.string().optional(),
  campaignId: z.string(),
});

// GET /api/chat/campaigns/:campaignId/config - Get widget configuration
router.get("/campaigns/:campaignId/config", async (req, res) => {
  try {
    const { campaignId } = req.params;

    // Get campaign details
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    // If campaign not found but it's a demo, return demo configuration
    if (!campaign) {
      if (campaignId.includes('demo')) {
        return res.json({
          campaign: {
            id: campaignId,
            name: "OfferLogix Demo Assistant",
            description: "Demonstration of OfferLogix AI Assistant capabilities",
          },
          branding: {
            primaryColor: "#0066cc",
            title: "OfferLogix Demo Assistant",
            greeting: "Hello! I'm the OfferLogix AI Assistant demo. I can help you understand our platform capabilities and answer questions about our services. How can I assist you?",
          },
          settings: {
            autoOpen: false,
            autoOpenDelay: 5000,
            position: "bottom-right",
            theme: "default",
          },
        });
      }
      return res.status(404).json({ message: "Campaign not found" });
    }

    // Return widget configuration for real campaigns
    res.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
      },
      branding: {
        primaryColor: "#0066cc",
        title: campaign.name || "OfferLogix AI Assistant",
        greeting: `Hello! I'm here to help you learn about ${campaign.name}. What would you like to know?`,
      },
      settings: {
        autoOpen: false,
        autoOpenDelay: 5000,
        position: "bottom-right",
        theme: "default",
      },
    });
  } catch (error) {
    console.error("Error loading widget config:", error);
    res.status(500).json({ message: "Failed to load widget configuration" });
  }
});

// POST /api/chat/sessions/init - Initialize chat session
router.post("/sessions/init", async (req, res) => {
  try {
    const sessionData = initSessionSchema.parse(req.body);

    // Generate session token and ID
    const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get campaign details for greeting
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, sessionData.campaignId))
      .limit(1);

    // Handle demo campaigns - use null campaignId to avoid foreign key constraints
    let actualCampaignId = sessionData.campaignId;
    if (sessionData.campaignId.includes('demo') && !campaign) {
      actualCampaignId = null;
    }

    // Create a lead record first (required by foreign key constraint)
    const placeholderEmail = `chat-widget-${Date.now()}@visitor.offerlogix.com`;
    const [lead] = await db
      .insert(leads)
      .values({
        email: placeholderEmail,
        firstName: "Chat",
        lastName: "Visitor", 
        leadSource: "chat_widget",
        status: "new",
        campaignId: actualCampaignId,
        notes: `Chat widget visitor from ${sessionData.pageUrl || 'unknown page'}`,
      })
      .returning();

    // Create conversation record using the lead ID
    const [conversation] = await db
      .insert(conversations)
      .values({
        leadId: lead.id, // Use actual lead ID
        campaignId: actualCampaignId,
        subject: `Chat Widget Conversation - ${new Date().toISOString().split('T')[0]}`,
        status: "active",
        priority: "normal",
      })
      .returning();

    const greeting = campaign
      ? `Hello! I'm your ${campaign.name} assistant. I can help you learn about our offers, answer questions, and guide you through our services. What would you like to know?`
      : sessionData.campaignId.includes('demo')
      ? "Hello! I'm the OfferLogix AI Assistant demo. I can help you understand our platform capabilities and answer questions about our services. How can I assist you?"
      : "Hello! I'm your OfferLogix AI Assistant. How can I help you find the perfect offer today?";

    res.json({
      sessionToken,
      sessionId,
      greeting,
      campaignName: campaign?.name || "OfferLogix Campaign",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request data", errors: error.errors });
    }
    console.error("Error initializing chat session:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("Session data:", JSON.stringify(req.body, null, 2));
    res.status(500).json({ 
      message: "Failed to initialize chat session",
      error: error instanceof Error ? error.message : "Unknown error",
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// POST /api/chat/messages - Send message and get AI response
router.post("/messages", async (req, res) => {
  try {
    const messageData = sendMessageSchema.parse(req.body);

    // Check if campaign exists, if not and it's a demo, create a default campaign
    let actualCampaignId = messageData.campaignId;
    if (messageData.campaignId.includes('demo')) {
      // For demo campaigns, check if campaign exists, if not create a demo one or use null
      const [existingCampaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, messageData.campaignId))
        .limit(1);
      
      if (!existingCampaign) {
        // Use null for demo conversations to avoid foreign key constraints
        actualCampaignId = null;
      }
    }

    // Find conversation by session token or campaign ID
    let conversation;
    if (messageData.sessionToken) {
      [conversation] = await db
        .select()
        .from(conversations)
        .where(
          and(
            actualCampaignId ? eq(conversations.campaignId, actualCampaignId) : isNull(conversations.campaignId),
            eq(conversations.status, "active")
          )
        )
        .orderBy(desc(conversations.createdAt))
        .limit(1);
    }

    // If no conversation found, create a new one
    if (!conversation) {
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create a lead record first (required by foreign key constraint)
      const placeholderEmail = `chat-message-${Date.now()}@visitor.offerlogix.com`;
      const [lead] = await db
        .insert(leads)
        .values({
          email: placeholderEmail,
          firstName: "Chat",
          lastName: "Visitor", 
          leadSource: "chat_widget",
          status: "new",
          campaignId: actualCampaignId,
          notes: `Chat widget visitor - direct message`,
        })
        .returning();

      [conversation] = await db
        .insert(conversations)
        .values({
          leadId: lead.id, // Use actual lead ID
          campaignId: actualCampaignId,
          subject: `Chat Widget Message - ${new Date().toISOString().split('T')[0]}`,
          status: "active",
          priority: "normal",
        })
        .returning();
    }

    // Save user message
    await db.insert(conversationMessages).values({
      conversationId: conversation.id,
      content: messageData.content,
      senderId: null, // avoid FK violation; user is not a registered platform user
      messageType: "text",
      isFromAI: 0,
    });

    // Get AI response using existing campaign chat service
    // Use actualCampaignId or fallback to a generic demo response
    let aiResponse;
    try {
      aiResponse = await processCampaignChat(
        messageData.content,
        actualCampaignId || messageData.campaignId,
        conversation.leadId,
        {
          conversationId: conversation.id,
          source: "chat_widget",
          previousMessages: [], // You might want to load previous messages for context
        }
      );
    } catch (error) {
      console.error("AI response error:", error);
      // Fallback response for demo
      aiResponse = {
        response: "Hello! I'm the OfferLogix AI Assistant. I can help you with information about our services, answer questions, and guide you through our offerings. How can I assist you today?",
        model: "fallback",
        shouldHandover: false
      };
    }

    // Save AI response
    await db.insert(conversationMessages).values({
      conversationId: conversation.id,
      content: aiResponse.response || (aiResponse as any).message,
      senderId: null, // avoid FK violation; AI is not a user record
      messageType: "text",
      isFromAI: 1,
    });

    // Check for handover signals
    const shouldHandover = aiResponse.shouldHandover || 
                          messageData.content.toLowerCase().includes("speak to human") ||
                          messageData.content.toLowerCase().includes("contact sales") ||
                          messageData.content.toLowerCase().includes("talk to agent");

    res.json({
      content: aiResponse.response || (aiResponse as any).message,
      shouldHandover,
      handoverReason: shouldHandover ? "User requested human assistance" : undefined,
      sessionToken: messageData.sessionToken,
      conversationId: conversation.id,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid message data", errors: error.errors });
    }
    console.error("Error processing chat message:", error);
    res.status(500).json({ 
      content: "I apologize, but I'm having trouble processing your message right now. Please try again or contact our support team.",
      shouldHandover: true,
      handoverReason: "System error"
    });
  }
});

// POST /api/chat/sessions/end - End chat session
router.post("/sessions/end", async (_req, res) => {
  try {
    // Session tokens not persisted; returning success without DB updates to avoid runtime errors

    if (sessionToken) {
      // Find and close conversation
      await db
        .update(conversations)
        .set({ 
          status: "completed",
          metadata: db.raw(`metadata || '{"endReason": "${reason || 'user_closed'}", "endedAt": "${new Date().toISOString()}"}'}`)
        })
        .where(
          db.raw(`metadata->>'sessionToken' = ?`, [sessionToken])
        );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error ending chat session:", error);
    res.status(500).json({ message: "Failed to end session" });
  }
});

// GET /api/chat/health - Health check endpoint
router.get("/health", async (req, res) => {
  try {
    // Test database connection
    await db.select().from(campaigns).limit(1);
    
    res.json({ 
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "offerlogix-chat-api",
      database: "connected"
    });
  } catch (error) {
    console.error("Chat API health check failed:", error);
    res.status(500).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      service: "offerlogix-chat-api",
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;