export const INTENT_SYSTEM_PROMPT = `You are an expert automotive sales assistant. Classify customer messages into dealership intents.`;

export const buildIntentUserPrompt = (message: string) => `Analyze the following message and identify all relevant intents from: pricing, test_drive, trade_in, financing, availability, features, appointment, complaint, other.
Return JSON {"intents": [{"intent": <intent>, "confidence": <0-100>}]}.
Message: "${message.replace(/`/g,'\`')}"`;