import { useQuery } from '@tanstack/react-query';
import { DashboardIntelligenceService, type DashboardIntelligence } from '@/services/dashboardIntelligence';

export function useDashboardIntelligence() {
  return useQuery<DashboardIntelligence>({
    queryKey: ['dashboard-intelligence'],
    queryFn: () => DashboardIntelligenceService.getDashboardIntelligence(),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export function useChatCampaign() {
  return {
    chatCampaign: (message: string) => DashboardIntelligenceService.chatCampaign(message)
  };
}