/**
 * Handover Badge Accessibility Tests
 * 
 * Ensures proper ARIA attributes and screen reader support
 * for handover status indicators.
 */

import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { 
  HandoverBadge, 
  ConversationHandoverBadge, 
  ListHandoverBadge,
  LiveHandoverIndicator 
} from '../HandoverBadge';

describe('HandoverBadge Accessibility', () => {
  describe('ARIA Attributes', () => {
    it('should have role="status" for status announcements', () => {
      render(<HandoverBadge />);
      
      const badge = screen.getByRole('status');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('role', 'status');
    });

    it('should have aria-live="polite" for non-urgent updates', () => {
      render(<HandoverBadge />);
      
      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-live', 'polite');
    });

    it('should include screen reader only description', () => {
      render(<HandoverBadge />);
      
      const description = screen.getByText(
        'This conversation has been transferred to a human agent for personalized assistance'
      );
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass('sr-only');
    });

    it('should mark decorative icons as aria-hidden', () => {
      const { container } = render(<HandoverBadge showIcon={true} />);
      
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Conversation Header Variant', () => {
    it('should have descriptive aria-label', () => {
      render(<ConversationHandoverBadge />);
      
      const badge = screen.getByLabelText('Conversation status: Handed over to human agent');
      expect(badge).toBeInTheDocument();
    });

    it('should be discoverable by role and text', () => {
      render(<ConversationHandoverBadge />);
      
      // Should be findable by role
      const statusBadge = screen.getByRole('status');
      expect(statusBadge).toBeInTheDocument();
      
      // Should contain expected text
      expect(statusBadge).toHaveTextContent('Handed over');
    });
  });

  describe('List Variant', () => {
    it('should have compact aria-label for list contexts', () => {
      render(<ListHandoverBadge />);
      
      const badge = screen.getByLabelText('Status: Handed over');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('Human');
    });

    it('should not show icon in compact mode', () => {
      const { container } = render(<ListHandoverBadge />);
      
      const icon = container.querySelector('svg');
      expect(icon).toBeNull();
    });
  });

  describe('Live Indicator', () => {
    it('should use aria-live="assertive" for urgent status changes', () => {
      render(<LiveHandoverIndicator isHandedOver={true} />);
      
      const indicator = screen.getByRole('status');
      expect(indicator.parentElement).toHaveAttribute('aria-live', 'assertive');
    });

    it('should announce status change to screen readers', () => {
      render(<LiveHandoverIndicator isHandedOver={true} />);
      
      const announcement = screen.getByText(
        'Conversation status updated: Now handled by human agent'
      );
      expect(announcement).toBeInTheDocument();
      expect(announcement).toHaveClass('sr-only');
    });

    it('should not render when not handed over', () => {
      const { container } = render(<LiveHandoverIndicator isHandedOver={false} />);
      
      expect(container.firstChild).toBeNull();
    });

    it('should render when handed over', () => {
      render(<LiveHandoverIndicator isHandedOver={true} />);
      
      const indicator = screen.getByRole('status');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('Screen Reader Experience', () => {
    it('should provide meaningful context without visual elements', () => {
      render(<HandoverBadge />);
      
      // All the information a screen reader needs should be present
      const visibleText = screen.getByText('Handed over');
      const detailedDescription = screen.getByText(
        'This conversation has been transferred to a human agent for personalized assistance'
      );
      
      expect(visibleText).toBeInTheDocument();
      expect(detailedDescription).toBeInTheDocument();
    });

    it('should work with screen reader navigation patterns', () => {
      render(
        <div>
          <h2>Conversation with John Doe</h2>
          <ConversationHandoverBadge />
          <p>Last message: Thanks for your help!</p>
        </div>
      );
      
      // Should be navigable by role
      const statusElements = screen.getAllByRole('status');
      expect(statusElements).toHaveLength(1);
      
      // Should be in logical document order
      const badge = screen.getByRole('status');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should not be focusable as it is status information', () => {
      render(<HandoverBadge />);
      
      const badge = screen.getByRole('status');
      expect(badge).not.toHaveAttribute('tabindex');
    });

    it('should work within focusable parent containers', () => {
      render(
        <button type="button">
          <span>View Conversation</span>
          <HandoverBadge />
        </button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      
      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
      
      // Status should be inside the button for context
      expect(button).toContainElement(status);
    });
  });

  describe('High Contrast Mode Support', () => {
    it('should have sufficient color contrast classes', () => {
      render(<HandoverBadge />);
      
      const badge = screen.getByRole('status');
      
      // Should have color classes that work in high contrast
      expect(badge).toHaveClass('text-orange-700');
      expect(badge).toHaveClass('bg-orange-50');
      expect(badge).toHaveClass('border-orange-200');
    });
  });

  describe('Integration with Real Components', () => {
    it('should integrate properly with conversation headers', () => {
      const ConversationHeader = () => (
        <header>
          <h1>Customer Conversation</h1>
          <div className="status-indicators">
            <LiveHandoverIndicator isHandedOver={true} />
          </div>
        </header>
      );

      render(<ConversationHeader />);
      
      const header = screen.getByRole('banner');
      const status = screen.getByRole('status');
      
      expect(header).toContainElement(status);
    });

    it('should work in conversation lists', () => {
      const ConversationList = () => (
        <ul>
          <li>
            <span>John Doe - Vehicle inquiry</span>
            <ListHandoverBadge />
          </li>
          <li>
            <span>Jane Smith - Service appointment</span>
          </li>
        </ul>
      );

      render(<ConversationList />);
      
      const list = screen.getByRole('list');
      const statusBadge = screen.getByRole('status');
      
      expect(list).toContainElement(statusBadge);
      expect(statusBadge).toHaveTextContent('Human');
    });
  });
});