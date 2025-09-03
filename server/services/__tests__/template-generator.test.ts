import { generateCampaignTemplate } from "../template-generator";

jest.mock("../openai", () => ({
  generateEmailTemplates: jest.fn(),
}));

jest.mock("../../storage", () => ({
  storage: {
    getCampaign: jest.fn(),
    createTemplate: jest.fn(),
  },
}));

const { generateEmailTemplates } = require("../openai");
const { storage } = require("../../storage");

describe("generateCampaignTemplate", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("generates and stores template", async () => {
    storage.getCampaign.mockResolvedValue({ id: "c1", name: "Test", context: "ctx" });
    (generateEmailTemplates as jest.Mock).mockResolvedValue([
      { subject: "Hello", content: "<p>Hi</p>", text: "Hi" },
    ]);
    storage.createTemplate.mockImplementation(async (data: any) => ({
      id: "t1",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));

    const result = await generateCampaignTemplate("c1");
    expect(storage.createTemplate).toHaveBeenCalledWith({
      campaignId: "c1",
      subject: "Hello",
      bodyHtml: "<p>Hi</p>",
      bodyText: "Hi",
    });
    expect(result).toMatchObject({
      campaignId: "c1",
      subject: "Hello",
      version: 1,
    });
  });

  it("throws when campaign missing", async () => {
    storage.getCampaign.mockResolvedValue(undefined);
    await expect(generateCampaignTemplate("missing")).rejects.toThrow("campaign_not_found");
  });

  it("handles AI errors", async () => {
    storage.getCampaign.mockResolvedValue({ id: "c1", name: "Test", context: "ctx" });
    (generateEmailTemplates as jest.Mock).mockRejectedValue(new Error("fail"));
    await expect(generateCampaignTemplate("c1")).rejects.toThrow("ai_generation_failed");
  });

  it("handles empty AI response", async () => {
    storage.getCampaign.mockResolvedValue({ id: "c1", name: "Test", context: "ctx" });
    (generateEmailTemplates as jest.Mock).mockResolvedValue([]);
    storage.createTemplate.mockImplementation(async (data: any) => ({
      id: "t1",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));

    const result = await generateCampaignTemplate("c1");
    expect(result.subject).toBe("Campaign Test");
  });

  it("handles empty template content", async () => {
    storage.getCampaign.mockResolvedValue({ id: "c1", name: "Test", context: "ctx" });
    (generateEmailTemplates as jest.Mock).mockResolvedValue([{ subject: "", content: "", text: "" }]);
    await expect(generateCampaignTemplate("c1")).rejects.toThrow("ai_generation_failed");
  });

  it("converts HTML to text properly", async () => {
    storage.getCampaign.mockResolvedValue({ id: "c1", name: "Test", context: "ctx" });
    (generateEmailTemplates as jest.Mock).mockResolvedValue([
      { subject: "Hello", content: "<p>Hello <strong>world</strong>!</p><br/>Nice day.", text: "" },
    ]);
    storage.createTemplate.mockImplementation(async (data: any) => ({
      id: "t1",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));

    const result = await generateCampaignTemplate("c1");
    expect(result.bodyText).toBe("Hello world!\n\nNice day.");
  });
});