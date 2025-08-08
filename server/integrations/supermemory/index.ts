// Main exports for Supermemory integration
export { supermemory, isRAGEnabled } from './client';
export { MemoryMapper } from './MemoryMapper';
export { 
  searchMemories, 
  searchForCampaignChat, 
  searchForLeadSignals, 
  searchForOptimizationComparables,
  buildSearchPayload
} from './QueryBuilder';
export { 
  campaignChatPrompt, 
  leadScoringPrompt, 
  optimizationPrompt 
} from './prompts';
export type { MemoryWrite } from './MemoryMapper';
export type { SearchInput } from './QueryBuilder';