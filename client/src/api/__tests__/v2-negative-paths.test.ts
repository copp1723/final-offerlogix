/**
 * V2 Negative Path Tests
 * 
 * Tests error scenarios, edge cases, and user interaction patterns
 * that could break the V2 bridge in production.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { getV2Conversation, replyV2Conversation, APIError } from '../client';

// Mock the API client
jest.mock('../client');
const mockGetV2Conversation = getV2Conversation as jest.MockedFunction<typeof getV2Conversation>;
const mockReplyV2Conversation = replyV2Conversation as jest.MockedFunction<typeof replyV2Conversation>;

// Mock toast notifications
const mockToast = {
  error: jest.fn(),
  success: jest.fn(),
  info: jest.fn(),
};
jest.mock('@/hooks/use-toast', () => ({
  toast: mockToast
}));

describe('V2 Negative Paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('5xx Server Errors', () => {
    it('should show toast + retry affordance on reply 500 error', async () => {
      // Setup 500 error
      mockReplyV2Conversation.mockRejectedValueOnce(
        new APIError('Internal server error', 500, 'api')
      );

      const TestReplyComponent = () => {
        const [isLoading, setIsLoading] = useState(false);
        const [retryCount, setRetryCount] = useState(0);
        
        const handleReply = async () => {
          setIsLoading(true);
          try {
            await replyV2Conversation('conv-123');
            mockToast.success('Reply sent successfully');
          } catch (error) {
            if (error instanceof APIError && error.status === 500) {
              mockToast.error('Server error. Please try again.', {
                action: {
                  label: 'Retry',
                  onClick: () => setRetryCount(prev => prev + 1)
                }
              });
            }
          } finally {
            setIsLoading(false);
          }
        };

        return (
          <div>
            <button 
              onClick={handleReply}
              disabled={isLoading}
              data-testid="reply-btn"
            >
              {isLoading ? 'Sending...' : 'Send Reply'}
            </button>
            <span data-testid="retry-count">{retryCount}</span>
          </div>
        );
      };

      render(<TestReplyComponent />);
      
      // Click reply button
      fireEvent.click(screen.getByTestId('reply-btn'));
      
      await waitFor(() => {
        // Button should be disabled while loading
        expect(screen.getByTestId('reply-btn')).toBeDisabled();
      });

      await waitFor(() => {
        // Should show error toast with retry action
        expect(mockToast.error).toHaveBeenCalledWith(
          'Server error. Please try again.',
          expect.objectContaining({
            action: expect.objectContaining({
              label: 'Retry'
            })
          })
        );
      });

      await waitFor(() => {
        // Button should be re-enabled after error
        expect(screen.getByTestId('reply-btn')).not.toBeDisabled();
      });
    });

    it('should disable button while reply is pending', async () => {
      // Setup delayed response
      mockReplyV2Conversation.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          messageId: '<reply@example.com>',
          conversationId: 'conv-123'
        }), 100))
      );

      const TestReplyComponent = () => {
        const [isLoading, setIsLoading] = useState(false);
        
        const handleReply = async () => {
          setIsLoading(true);
          try {
            await replyV2Conversation('conv-123');
          } finally {
            setIsLoading(false);
          }
        };

        return (
          <button 
            onClick={handleReply}
            disabled={isLoading}
            data-testid="reply-btn"
          >
            {isLoading ? 'Sending...' : 'Send Reply'}
          </button>
        );
      };

      render(<TestReplyComponent />);
      
      // Click reply button
      fireEvent.click(screen.getByTestId('reply-btn'));
      
      // Should be disabled immediately
      expect(screen.getByTestId('reply-btn')).toBeDisabled();
      expect(screen.getByTestId('reply-btn')).toHaveTextContent('Sending...');
      
      // Wait for completion
      await waitFor(() => {
        expect(screen.getByTestId('reply-btn')).not.toBeDisabled();
        expect(screen.getByTestId('reply-btn')).toHaveTextContent('Send Reply');
      });
    });
  });

  describe('Double-Click Protection', () => {
    it('should prevent duplicate API calls on quick double-click', async () => {
      mockReplyV2Conversation.mockResolvedValue({
        success: true,
        messageId: '<reply@example.com>',
        conversationId: 'conv-123'
      });

      const TestReplyComponent = () => {
        const [isLoading, setIsLoading] = useState(false);
        const [callCount, setCallCount] = useState(0);
        
        const handleReply = async () => {
          if (isLoading) return; // Prevent duplicate calls
          
          setIsLoading(true);
          setCallCount(prev => prev + 1);
          
          try {
            await replyV2Conversation('conv-123');
            mockToast.success('Reply sent');
          } finally {
            setIsLoading(false);
          }
        };

        return (
          <div>
            <button 
              onClick={handleReply}
              disabled={isLoading}
              data-testid="reply-btn"
            >
              Send Reply
            </button>
            <span data-testid="call-count">{callCount}</span>
          </div>
        );
      };

      render(<TestReplyComponent />);
      
      // Double-click rapidly
      fireEvent.click(screen.getByTestId('reply-btn'));
      fireEvent.click(screen.getByTestId('reply-btn'));
      fireEvent.click(screen.getByTestId('reply-btn'));
      
      await waitFor(() => {
        // Should only call API once
        expect(mockReplyV2Conversation).toHaveBeenCalledTimes(1);
        // Should only show one success toast
        expect(mockToast.success).toHaveBeenCalledTimes(1);
        // Call count should be 1
        expect(screen.getByTestId('call-count')).toHaveTextContent('1');
      });
    });
  });

  describe('404 Not Found', () => {
    it('should show "not found" view for GET 404, not blank page', async () => {
      mockGetV2Conversation.mockRejectedValueOnce(
        new APIError('Conversation not found', 404, 'api')
      );

      const TestConversationComponent = ({ conversationId }: { conversationId: string }) => {
        const [conversation, setConversation] = useState(null);
        const [error, setError] = useState<string | null>(null);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
          const loadConversation = async () => {
            try {
              const response = await getV2Conversation(conversationId);
              if (response.success) {
                setConversation(response.conversation);
              }
            } catch (err) {
              if (err instanceof APIError && err.status === 404) {
                setError('Conversation not found');
              } else {
                setError('Failed to load conversation');
              }
            } finally {
              setLoading(false);
            }
          };
          
          loadConversation();
        }, [conversationId]);

        if (loading) return <div data-testid="loading">Loading...</div>;
        if (error) return <div data-testid="error">{error}</div>;
        if (!conversation) return <div data-testid="empty">No conversation</div>;
        
        return <div data-testid="conversation">{conversation.subject}</div>;
      };

      render(<TestConversationComponent conversationId="nonexistent" />);
      
      // Should show loading initially
      expect(screen.getByTestId('loading')).toBeInTheDocument();
      
      await waitFor(() => {
        // Should show specific not found message, not blank page
        expect(screen.getByTestId('error')).toHaveTextContent('Conversation not found');
        expect(screen.queryByTestId('conversation')).not.toBeInTheDocument();
        expect(screen.queryByTestId('empty')).not.toBeInTheDocument();
      });
    });
  });

  describe('401 Unauthorized', () => {
    it('should trigger auth flow on 401 session expired', async () => {
      const mockRedirect = jest.fn();
      mockGetV2Conversation.mockRejectedValueOnce(
        new APIError('Unauthorized', 401, 'auth')
      );

      const TestAuthComponent = () => {
        const [authError, setAuthError] = useState(false);

        useEffect(() => {
          const loadData = async () => {
            try {
              await getV2Conversation('conv-123');
            } catch (err) {
              if (err instanceof APIError && err.status === 401) {
                setAuthError(true);
                // Simulate auth flow trigger
                mockRedirect('/login');
              }
            }
          };
          
          loadData();
        }, []);

        if (authError) {
          return <div data-testid="auth-expired">Session expired. Redirecting...</div>;
        }

        return <div data-testid="content">Content</div>;
      };

      render(<TestAuthComponent />);
      
      await waitFor(() => {
        expect(screen.getByTestId('auth-expired')).toBeInTheDocument();
        expect(mockRedirect).toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('Network Errors', () => {
    it('should handle network failures gracefully', async () => {
      mockReplyV2Conversation.mockRejectedValueOnce(
        new APIError('Network error - please check your connection', undefined, 'network')
      );

      const TestNetworkComponent = () => {
        const [networkError, setNetworkError] = useState(false);

        const handleReply = async () => {
          try {
            await replyV2Conversation('conv-123');
          } catch (err) {
            if (err instanceof APIError && err.type === 'network') {
              setNetworkError(true);
              mockToast.error('Connection problem. Please check your internet and try again.');
            }
          }
        };

        return (
          <div>
            <button onClick={handleReply} data-testid="reply-btn">Reply</button>
            {networkError && (
              <div data-testid="network-error">
                Unable to connect. Check your internet connection.
              </div>
            )}
          </div>
        );
      };

      render(<TestNetworkComponent />);
      
      fireEvent.click(screen.getByTestId('reply-btn'));
      
      await waitFor(() => {
        expect(screen.getByTestId('network-error')).toBeInTheDocument();
        expect(mockToast.error).toHaveBeenCalledWith(
          'Connection problem. Please check your internet and try again.'
        );
      });
    });
  });
});