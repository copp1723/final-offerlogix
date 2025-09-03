import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '@/api/client';

export const useDashboard = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 60000, // Refresh every minute
  });
};