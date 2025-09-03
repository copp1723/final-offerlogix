import type { DashboardResponse } from '@/types/api';
import { getAuthHeaders } from '@/lib/queryClient';
import type { V2Conversation } from '@/types/api';

/**
 * Structured API error with status code and error type for better handling
 */
export class APIError extends Error {
  status?: number;
  type: string;

  constructor(message: string, status?: number, type: string = 'unknown') {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.type = type;
  }
}

// Guard against undefined import.meta in non-Vite environments (e.g., tests)
const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_URL) || '';

/**
 * Handle fetch responses and throw structured APIError when needed
 */
async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    let type = 'api';
    
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
      else if (data?.message) message = data.message;
      if (data?.type) type = data.type;
    } catch {
      try {
        message = await res.text() || message;
      } catch {
        // Use default statusText
      }
    }
    
    // Categorize by status code if no explicit type
    if (type === 'api') {
      if (res.status >= 500) type = 'api';
      else if (res.status === 401 || res.status === 403) type = 'auth';
      else if (res.status === 400) type = 'validation';
      else if (res.status === 429) type = 'rate_limit';
    }
    
    throw new APIError(message || 'Request failed', res.status, type);
  }

  return res.json() as Promise<T>;
}

export async function getDashboard(): Promise<DashboardResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/dashboard`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse<DashboardResponse>(res);
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError('Network error - please check your connection', undefined, 'network');
  }
}

export async function chatCampaign(body: { message: string; currentStep?: string; campaignData?: any }) {
  try {
    const res = await fetch(`${API_BASE}/api/ai/chat-campaign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(body),
    });
    return await handleResponse<{ message: string; nextStep?: string; isComplete?: boolean; campaignData?: any }>(res);
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError('Network error - please check your connection', undefined, 'network');
  }
}

// ============================================================================
// V2 API METHODS - MINIMAL UI BRIDGE
// ============================================================================

export async function getV2Conversation(id: string) {
  try {
    const res = await fetch(`${API_BASE}/v2/conversations/${id}`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse<{ 
      success: boolean;
      conversation: {
        id: string;
        agentId: string;
        leadEmail: string;
        subject: string;
        status: string;
        lastMessageId: string | null;
        updatedAt: string;
      };
    }>(res);
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError('Network error - please check your connection', undefined, 'network');
  }
}

export async function replyV2Conversation(id: string) {
  try {
    const res = await fetch(`${API_BASE}/v2/conversations/${id}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({}), // body ignored per spec
    });
    return await handleResponse<{ 
      success: boolean;
      messageId: string;
      conversationId: string;
    }>(res);
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError('Network error - please check your connection', undefined, 'network');
  }
}

// List recent V2 conversations
export async function listV2Conversations(params?: { agentId?: string; status?: string; limit?: number }) {
  try {
    const qs = new URLSearchParams();
    if (params?.agentId) qs.set('agentId', params.agentId);
    if (params?.status) qs.set('status', params.status);
    if (params?.limit) qs.set('limit', String(params.limit));
    const url = `${API_BASE}/v2/conversations${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    return await handleResponse<{ success: boolean; conversations: V2Conversation[] }>(res);
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError('Network error - please check your connection', undefined, 'network');
  }
}

// Get V2 messages for a conversation
export async function getV2Messages(conversationId: string) {
  try {
    const res = await fetch(`${API_BASE}/v2/conversations/${conversationId}/messages`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse<{ success: boolean; messages: Array<{ id: string; sender: 'agent' | 'lead'; content: string; status: string; createdAt: string }> }>(res);
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError('Network error - please check your connection', undefined, 'network');
  }
}
