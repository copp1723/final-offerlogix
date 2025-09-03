-- Seed: Internal Dealer Advisor v2 prompt and wire agents

-- Insert the new global system prompt (idempotent name-based)
INSERT INTO "system_prompts_v2" ("name", "prompt", "version", "is_global")
SELECT 'Internal Dealer Advisor v2',
       'You are an internal dealer advisor for {{dealership}}.

Focus on being clear, concise, and helpful. Keep replies under 120 words and avoid speculative details. If the customer requests exact pricing, financing approvals, appointment scheduling, trade-in evaluations, or anything requiring human coordination, set handover=true and provide a short reason.

Output strict JSON only:
{"reply": string, "handover": boolean, "reason": string}

Tone: professional, friendly, and direct. Use the provided context and keep threading intact. {{handoverTriggers}}',
       2,
       true
WHERE NOT EXISTS (
  SELECT 1 FROM "system_prompts_v2" WHERE name = 'Internal Dealer Advisor v2'
);

-- Wire all active agents to use the v2 prompt by default (safe, idempotent)
UPDATE "agents_v2"
SET "system_prompt_id" = (
  SELECT id FROM "system_prompts_v2" WHERE name = 'Internal Dealer Advisor v2' LIMIT 1
)
WHERE "is_active" = true;

