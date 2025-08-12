import type { DashboardResponse } from '@/types/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function getDashboard(): Promise<DashboardResponse> {
  const res = await fetch(`${API_BASE}/api/dashboard`);

  if (!res.ok) {
    // If API not available, return mock data for development
    if (import.meta.env.DEV) {
      console.warn('API not available, using mock data');
      return getMockDashboard();
    }
    throw new Error(`Failed to load dashboard: ${res.statusText}`);
  }

  return res.json();
}

export async function chatCampaign(body: { message: string; currentStep?: string; campaignData?: any }) {
  const res = await fetch(`${API_BASE}/api/ai/chat-campaign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to process chat');
  return res.json() as Promise<{ message: string; nextStep?: string; isComplete?: boolean; campaignData?: any }>;
}


// Mock data for development
function getMockDashboard(): DashboardResponse {
  return {
    leads: [
      {
        id: '1',
        name: 'Bob Brown',
        email: 'bob@email.com',
        status: 'hot',
        score: 95,
        lastContact: '2 hours ago',
        snippet: 'Just had twins - needs 7-seater urgently',
        insights: {
          situation: 'Just had twins, needs larger vehicle urgently',
          preferences: ['Tahoe', 'Expedition', '7+ seats'],
          budget: 'Pre-approved for $65k',
          timeline: 'ASAP - wife\'s car broke down',
          concerns: ['Fuel economy', 'Safety ratings'],
        },
        recommendedActions: [
          { action: 'Show Tahoe Hybrid in stock', urgency: 'high', reason: 'Addresses fuel concern + family needs' },
          { action: 'Schedule family test drive', urgency: 'high', reason: 'Urgent timeline' },
          { action: 'Send safety comparison', urgency: 'medium', reason: 'Key concern mentioned' },
        ],
        conversation: [
          { role: 'customer', message: 'We just had twins and need a bigger car', timestamp: '3 days ago' },
          { role: 'agent', message: 'Congratulations! Let me help you find the perfect family vehicle.', timestamp: '3 days ago' },
          { role: 'customer', message: 'Something with a third row. My wife likes the Tahoe', timestamp: '3 days ago' },
        ],
      },
      {
        id: '2',
        name: 'Carol Davis',
        email: 'carol@email.com',
        status: 'warm',
        score: 75,
        lastContact: '1 day ago',
        snippet: 'Comparing with Toyota - budget under $35k',
        insights: {
          budget: 'Firm under $35k',
          competitor: 'Getting quote from Toyota tomorrow',
          timeline: 'Within 2 weeks',
          preferences: ['AWD', 'Good MPG'],
        },
        recommendedActions: [
          { action: 'Send comparison vs RAV4', urgency: 'high', reason: 'Meeting Toyota tomorrow' },
          { action: 'Highlight current incentives', urgency: 'medium', reason: 'Price sensitive' },
        ],
      },
      {
        id: '3',
        name: 'David Miller',
        email: 'david@email.com',
        status: 'cold',
        score: 45,
        lastContact: '5 days ago',
        snippet: 'Financing expired - interested in trucks',
        insights: {
          situation: 'Previous financing fell through',
          preferences: ['Work truck', 'Towing capacity'],
        },
        recommendedActions: [
          { action: 'Send new financing options', urgency: 'high', reason: 'Previous approval expired' },
          { action: 'Show work truck inventory', urgency: 'low', reason: 'Keep engaged' },
        ],
      },
    ],

    intelligence: {
      followUps: [
        { leadName: 'Sarah Johnson', reason: 'Said "check back in 3 months" (90 days ago)', overdue: false },
        { leadName: 'Mike Roberts', reason: 'Lease ends this month per conversation', overdue: false },
        { leadName: 'Lisa Thompson', reason: 'Requested April follow-up', overdue: false },
      ],
      callList: [
        { leadName: 'Bob Brown', score: 95, reasons: ['Multiple inquiries', 'Opened last 5 emails', 'Urgent need'] },
        { leadName: 'Carol Davis', score: 88, reasons: ['Mentioned competitor', 'High engagement'] },
        { leadName: 'Tom Wilson', score: 82, reasons: ['3 unanswered inquiries', 'Viewed inventory'] },
      ],
      campaigns: [
        { type: 'Tax Season', description: '8 leads mentioned tax refunds', count: 8, suggestedAction: 'Create tax refund financing campaign' },
        { type: 'Lease End', description: '4 leases expiring within 60 days', count: 4, suggestedAction: 'Launch lease renewal offers' },
        { type: 'Dormant', description: '12 leads inactive 30+ days', count: 12, suggestedAction: 'Start re-engagement sequence' },
      ],
    },

    agent: {
      suggestions: [
        'Create campaign for 4 lease-end customers this month',
        'Follow up with 8 leads who mentioned tax refunds',
        'Target 3 hot leads with personalized offers',
      ],
      recentActivity: [
        'Campaign "Spring Sale" sent to 45 leads',
        '12 new leads added this week',
        '5 leads moved to hot status',
      ],
    },

    summary: {
      hotLeadsNeedingAttention: 3,
      competitorMentions: ['Carol Davis: Toyota tomorrow', 'Amy Chen: Honda quote'],
      expiringOpportunities: ['Bob Brown: Needs vehicle ASAP', 'Mike Roberts: Lease ends this month'],
    },
  };
}