# Centralized JSON Schema Management Migration Guide

## Overview

A new centralized prompt schema management system has been implemented at `/Users/joshcopp/Desktop/MailMind/server/services/prompt-schemas.ts`. This system provides:

- **Type-safe schema definitions** using TypeScript interfaces and Zod validation
- **Runtime validation** with comprehensive error handling  
- **Template generation** for consistent prompt formatting
- **Backward compatibility** with existing response formats
- **Migration helpers** for easy adoption

## New System Architecture

### Core Components

1. **Schema Definitions**: TypeScript interfaces + Zod schemas for all AI responses
2. **Validation Functions**: Runtime validation with error recovery
3. **Template Generators**: Functions to generate consistent JSON schema prompts
4. **Schema Registry**: Central registry for dynamic schema access
5. **Migration Helpers**: Utilities to ease transition from inline schemas

### Available Schemas

| Schema Type | Description | Source Files |
|------------|-------------|--------------|
| `AiChatResponse` | AI campaign chat responses | `ai-chat.ts` |
| `CampaignOptimization` | Campaign optimization recommendations | `supermemory/prompts.ts` |
| `LeadScoring` | Lead scoring and qualification | `supermemory/prompts.ts` |
| `CampaignGoals` | Campaign goal suggestions | `openai.ts` |
| `CampaignNames` | Campaign name suggestions | `openai.ts` |
| `EnhancedTemplates` | Email templates + subject lines | `openai.ts` |
| `SubjectLines` | Email subject line suggestions | `openai.ts` |
| `EmailTemplates` | Structured email templates | `openai.ts` |
| `IntentAnalysis` | Customer intent classification | `advanced-conversation-analytics.ts` |

## Migration Strategy

### Phase 1: Import and Use (Low Risk)

Start using the new schemas alongside existing code:

```typescript
// Before
const result = JSON.parse(response.choices[0].message.content || '{"goals": []}');

// After
import { parseAndValidate, CampaignGoalsSchema } from './prompt-schemas';
const result = parseAndValidate(
  response.choices[0].message.content || '{"goals": []}', 
  CampaignGoalsSchema, 
  'CampaignGoals'
);
```

### Phase 2: Replace Inline Schemas (Medium Risk)

Replace hardcoded schema strings with centralized templates:

```typescript
// Before
const prompt = `Respond with JSON: {"goals": ["goal1", "goal2"]}`;

// After  
import { getSchemaPrompt } from './prompt-schemas';
const prompt = `Respond with JSON: ${getSchemaPrompt('campaignGoals')}`;
```

### Phase 3: Full Migration (Higher Risk)

Completely refactor to use centralized system:

```typescript
// Before
async function suggestGoals(context: string): Promise<string[]> {
  // ... API call logic
  const result = JSON.parse(response.content || '{"goals": []}');
  return result.goals || [];
}

// After
import { validateSchemaResponse } from './prompt-schemas';
async function suggestGoals(context: string): Promise<string[]> {
  // ... API call logic  
  const result = validateSchemaResponse('campaignGoals', JSON.parse(response.content || '{}'));
  return result.goals || [];
}
```

## Specific Migration Examples

### 1. AI Chat Service (`ai-chat.ts`)

**Current Implementation:**
```typescript
// Lines 81-87
content: `You are an AI Campaign Agent for automotive marketing. Respond with JSON in this exact format:
{
  "message": "Your conversational response here", 
  "nextStep": "campaign_type|target_audience|goals|details|complete",
  "campaignData": {"name": "...", "context": "...", "handoverGoals": "...", "numberOfTemplates": 5, "daysBetweenMessages": 3},
  "isComplete": false
}`
```

**Migrated Version:**
```typescript
import { getAiChatSchemaPrompt, parseAndValidate, AiChatResponseSchema } from './prompt-schemas';

// Replace inline schema with:
content: `You are an AI Campaign Agent for automotive marketing. ${getAiChatSchemaPrompt()}`

// Replace JSON.parse with:
const parsedResponse = parseAndValidate(aiResponse, AiChatResponseSchema, 'AiChat');
```

### 2. OpenAI Service (`openai.ts`)

**Current Implementation:**
```typescript
// Lines 58-59
const result = JSON.parse(response.choices[0].message.content || '{"goals": []}');
return result.goals || [];
```

**Migrated Version:**
```typescript
import { validateSchemaResponse } from './prompt-schemas';

const result = validateSchemaResponse('campaignGoals', 
  JSON.parse(response.choices[0].message.content || '{"goals": []}')
);
return result.goals || [];
```

### 3. Supermemory Prompts (`supermemory/prompts.ts`)

**Current Implementation:**
```typescript
// Lines 61-67 (leadScoringPrompt return)
Return JSON:
{
  "qualification": 0-100,
  "urgency": 0-100, 
  "handover": 0-100,
  "signals": ["string", ...],
  "reasoning": "1-3 short bullets"
}
```

**Migrated Version:**
```typescript
import { getLeadScoringSchemaPrompt } from '../services/prompt-schemas';

// Replace hardcoded JSON with:
return `${prompt}\n\n${getLeadScoringSchemaPrompt()}`;
```

### 4. Sales Brief Generator (`sales-brief-generator.ts`)

**Current Implementation:**
```typescript
// Already uses SalesBriefSchema from shared/sales-brief-schema.ts
return SalesBriefSchema.parse(rawResponse);
```

**Migration Note:**
This file already follows best practices! The new system includes a compatibility bridge:

```typescript
import { validateSalesBriefResponse } from './prompt-schemas';
// This internally uses the existing SalesBriefSchema
```

## Benefits After Migration

### 1. Type Safety
- Compile-time validation of schema structures
- Autocomplete for schema fields
- Reduced runtime errors

### 2. Consistency
- Standardized error messages
- Uniform validation logic
- Centralized schema updates

### 3. Maintainability  
- Single source of truth for all schemas
- Easy schema evolution
- Comprehensive test coverage

### 4. Error Recovery
- Automatic fixing of common validation issues
- Fallback values for missing fields
- Better error reporting

## Files Ready for Migration

### High Priority (Direct Schema Usage)
1. `/Users/joshcopp/Desktop/MailMind/server/services/ai-chat.ts` - Line 81-87, 108
2. `/Users/joshcopp/Desktop/MailMind/server/services/openai.ts` - Lines 59, 108, 155, 214, 256  
3. `/Users/joshcopp/Desktop/MailMind/server/integrations/supermemory/prompts.ts` - Lines 30-35, 61-67, 90-99

### Medium Priority (JSON Parsing)
4. `/Users/joshcopp/Desktop/MailMind/server/services/advanced-conversation-analytics.ts` - Lines 240, 414, 595
5. `/Users/joshcopp/Desktop/MailMind/server/services/reply-planner-enhanced.ts` - Lines 51, 206
6. `/Users/joshcopp/Desktop/MailMind/server/services/campaign-chat.ts` - Lines 1125, 1465, 1474

### Low Priority (Generic JSON Usage)  
7. `/Users/joshcopp/Desktop/MailMind/server/services/response-quality-optimizer.ts` - Line 695
8. `/Users/joshcopp/Desktop/MailMind/server/services/enhanced-conversation-ai.ts` - Line 187
9. `/Users/joshcopp/Desktop/MailMind/server/services/ai/replyPlanner.ts` - Line 226

## Testing Strategy

The new system includes comprehensive tests at `/Users/joshcopp/Desktop/MailMind/server/services/__tests__/prompt-schemas.test.ts`:

- ✅ Schema validation for all response types
- ✅ Error handling and recovery
- ✅ Template generation
- ✅ Registry functionality
- ✅ Utility functions

## Safety Guarantees

1. **Backward Compatibility**: All existing response formats are supported
2. **No Breaking Changes**: New system can be adopted incrementally
3. **Fallback Mechanisms**: Graceful degradation if validation fails
4. **Type Safety**: Compile-time validation prevents runtime errors
5. **Comprehensive Testing**: Full test coverage ensures reliability

## Next Steps

1. **Review** this implementation and ensure it meets requirements
2. **Test** the new system with existing data
3. **Migrate** one service at a time starting with high-priority files
4. **Monitor** for any compatibility issues
5. **Iterate** and improve based on usage patterns

The centralized schema system is ready for production use and provides a solid foundation for scaling AI prompt management across the MailMind codebase.