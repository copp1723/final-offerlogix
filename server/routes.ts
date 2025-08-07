import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCampaignSchema } from "@shared/schema";
import { suggestCampaignGoals, enhanceEmailTemplates, generateSubjectLines } from "./services/openai";

export async function registerRoutes(app: Express): Promise<Server> {
  // Campaign routes
  app.get("/api/campaigns", async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/campaigns/:id", async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  app.post("/api/campaigns", async (req, res) => {
    try {
      const campaignData = insertCampaignSchema.parse(req.body);
      const campaign = await storage.createCampaign(campaignData);
      res.json(campaign);
    } catch (error) {
      res.status(400).json({ message: "Invalid campaign data" });
    }
  });

  app.put("/api/campaigns/:id", async (req, res) => {
    try {
      const campaignData = insertCampaignSchema.partial().parse(req.body);
      const campaign = await storage.updateCampaign(req.params.id, campaignData);
      res.json(campaign);
    } catch (error) {
      res.status(400).json({ message: "Failed to update campaign" });
    }
  });

  app.delete("/api/campaigns/:id", async (req, res) => {
    try {
      await storage.deleteCampaign(req.params.id);
      res.json({ message: "Campaign deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  // AI Enhancement routes
  app.post("/api/ai/enhance-templates", async (req, res) => {
    try {
      const { context, name } = req.body;
      if (!context || !name) {
        return res.status(400).json({ message: "Context and name are required" });
      }

      const result = await enhanceEmailTemplates(context, name);
      res.json(result);
    } catch (error) {
      console.error('AI enhance templates error:', error);
      res.status(500).json({ message: "Failed to generate templates" });
    }
  });

  app.post("/api/ai/generate-subjects", async (req, res) => {
    try {
      const { context, name } = req.body;
      if (!context || !name) {
        return res.status(400).json({ message: "Context and name are required" });
      }

      const subjectLines = await generateSubjectLines(context, name);
      res.json({ subjectLines });
    } catch (error) {
      console.error('AI generate subjects error:', error);
      res.status(500).json({ message: "Failed to generate subject lines" });
    }
  });

  app.post("/api/ai/suggest-goals", async (req, res) => {
    try {
      const { context } = req.body;
      if (!context) {
        return res.status(400).json({ message: "Context is required" });
      }

      const goals = await suggestCampaignGoals(context);
      res.json({ goals });
    } catch (error) {
      console.error('AI suggest goals error:', error);
      res.status(500).json({ message: "Failed to generate goals" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
