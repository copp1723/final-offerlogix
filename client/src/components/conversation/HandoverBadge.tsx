/**
 * Handover Badge Component with Accessibility Support
 * 
 * Shows when a conversation has been handed over to a human agent.
 * Includes proper ARIA attributes for screen readers.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HandoverBadgeProps {
  className?: string;
  variant?: 'default' | 'outline' | 'secondary';
  showIcon?: boolean;
  children?: React.ReactNode;
}

export function HandoverBadge({ 
  className, 
  variant = 'secondary',
  showIcon = true,
  children 
}: HandoverBadgeProps) {
  return (
    <Badge
      variant={variant}
      role="status"
      aria-live="polite"
      className={cn(
        "gap-1 text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100",
        className
      )}
    >
      {showIcon && <UserCheck className="w-3 h-3" aria-hidden="true" />}
      
      {/* Visible text */}
      <span>
        {children || "Handed over"}
      </span>
      
      {/* Screen reader only - detailed description */}
      <span className="sr-only">
        This conversation has been transferred to a human agent for personalized assistance
      </span>
    </Badge>
  );
}

// Variant for conversation headers
export function ConversationHandoverBadge({ className }: { className?: string }) {
  return (
    <HandoverBadge 
      className={className}
      aria-label="Conversation status: Handed over to human agent"
    >
      Handed over
    </HandoverBadge>
  );
}

// Variant for conversation lists  
export function ListHandoverBadge({ className }: { className?: string }) {
  return (
    <HandoverBadge 
      className={cn("text-xs", className)}
      showIcon={false}
      aria-label="Status: Handed over"
    >
      Human
    </HandoverBadge>
  );
}

// Status indicator for real-time updates
export function LiveHandoverIndicator({ 
  isHandedOver, 
  className 
}: { 
  isHandedOver: boolean; 
  className?: string;
}) {
  if (!isHandedOver) return null;
  
  return (
    <div 
      role="status" 
      aria-live="assertive"
      className={cn("inline-flex items-center", className)}
    >
      <HandoverBadge />
      <span className="sr-only">
        Conversation status updated: Now handled by human agent
      </span>
    </div>
  );
}