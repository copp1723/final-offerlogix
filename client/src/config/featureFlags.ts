/**
 * Feature Flags Configuration
 * 
 * Centralized feature toggles for controlled rollout and A/B testing.
 */

/**
 * Enable V2 UI Bridge - Controls whether to use V2 endpoints for conversation management
 * 
 * When enabled:
 * - V2 agents will use /v2/conversations endpoints
 * - Shows handover status and badges  
 * - Enables structured logging for v2_reply_sent events
 * 
 * Rollout strategy:
 * - false (default): All users on V1 behavior
 * - true (pilot): Staff/pilot environment only
 * - Combined with agent.useV2 flag for per-agent control
 */
export const ENABLE_V2_UI = import.meta.env.VITE_ENABLE_V2_UI === 'true';

/**
 * Development mode flag for debugging
 */
export const DEV_MODE = import.meta.env.DEV;

/**
 * Check if V2 should be used for a given agent
 * @param agent - Agent object with useV2 property
 * @returns boolean indicating if V2 endpoints should be used
 */
export function shouldUseV2(agent?: { useV2?: boolean }): boolean {
  return ENABLE_V2_UI && agent?.useV2 === true;
}

/**
 * Development helper to log V2 usage
 * Only logs in development mode
 */
export function logV2Usage(conversationId: string, action: string, agentId?: string): void {
  if (DEV_MODE) {
    console.log(`[V2 Bridge] ${action} for conversation ${conversationId}${agentId ? ` (agent: ${agentId})` : ''}`);
  }
}

/**
 * Development warning for V1 endpoint usage when V2 is expected
 * Only warns in development mode
 */
export function warnV1Fallback(conversationId: string, reason: string, agentId?: string): void {
  if (DEV_MODE) {
    console.warn(`[V2 Bridge] Falling back to V1 for conversation ${conversationId}: ${reason}${agentId ? ` (agent: ${agentId})` : ''}`);
  }
}

/**
 * Development warning for unexpected V1 endpoint calls during V2 operations
 * Only warns in development mode
 */
export function warnUnexpectedV1Usage(endpoint: string, conversationId: string): void {
  if (DEV_MODE) {
    console.warn(`[V2 Bridge] Unexpected V1 endpoint call: ${endpoint} for conversation ${conversationId}. This may indicate a bug in V2 bridge logic.`);
  }
}

/**
 * Feature flag utilities
 */
export const FeatureFlags = {
  V2_UI: ENABLE_V2_UI,
  DEV_MODE,

  // Helper for conditional rendering
  isV2Enabled: () => ENABLE_V2_UI,

  // Helper for dev-only features
  isDev: () => DEV_MODE,

  // Helper for V2 agent detection
  shouldUseV2,

  // Development logging helpers
  logV2Usage,
  warnV1Fallback,
  warnUnexpectedV1Usage,
} as const;