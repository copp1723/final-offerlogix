/**
 * V2 Debug Badge Component
 * 
 * Shows a subtle "V2" badge in development mode when the V2 bridge is active.
 * Only renders in development environment for debugging purposes.
 */

import { FeatureFlags } from '@/config/featureFlags';

interface V2DebugBadgeProps {
  /** Whether V2 is currently active for this component/conversation */
  isV2Active: boolean;
  /** Optional additional debug info to show on hover */
  debugInfo?: {
    agentId?: string;
    conversationId?: string;
    reason?: string;
  };
  /** Position of the badge */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Size variant */
  size?: 'sm' | 'md';
}

export function V2DebugBadge({ 
  isV2Active, 
  debugInfo, 
  position = 'top-right',
  size = 'sm'
}: V2DebugBadgeProps) {
  // Only render in development mode
  if (!FeatureFlags.isDev()) {
    return null;
  }

  // Only render if V2 is active
  if (!isV2Active) {
    return null;
  }

  const positionClasses = {
    'top-right': 'top-2 right-2',
    'top-left': 'top-2 left-2',
    'bottom-right': 'bottom-2 right-2',
    'bottom-left': 'bottom-2 left-2'
  };

  const sizeClasses = {
    'sm': 'text-xs px-1.5 py-0.5',
    'md': 'text-sm px-2 py-1'
  };

  const tooltipContent = debugInfo ? (
    <div className="text-xs">
      <div className="font-semibold">V2 Bridge Active</div>
      {debugInfo.agentId && <div>Agent: {debugInfo.agentId}</div>}
      {debugInfo.conversationId && <div>Conv: {debugInfo.conversationId}</div>}
      {debugInfo.reason && <div>Reason: {debugInfo.reason}</div>}
    </div>
  ) : (
    'V2 Bridge Active'
  );

  return (
    <div 
      className={`
        absolute z-50 ${positionClasses[position]}
        bg-blue-500 text-white rounded-md font-mono font-bold
        ${sizeClasses[size]}
        shadow-lg border border-blue-400
        hover:bg-blue-600 transition-colors cursor-help
      `}
      title={typeof tooltipContent === 'string' ? tooltipContent : undefined}
    >
      V2
      {debugInfo && (
        <div className="absolute invisible group-hover:visible bg-gray-900 text-white text-xs rounded py-1 px-2 -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-60">
          {tooltipContent}
        </div>
      )}
    </div>
  );
}

/**
 * Hook to get V2 debug information for the current context
 */
export function useV2DebugInfo(conversationId?: string, agentId?: string) {
  if (!FeatureFlags.isDev()) {
    return null;
  }

  return {
    isV2Enabled: FeatureFlags.V2_UI,
    conversationId,
    agentId,
    timestamp: new Date().toISOString()
  };
}
