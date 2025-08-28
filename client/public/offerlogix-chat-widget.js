/**
 * OfferLogix Chat Widget
 * Embeddable chat widget with Shadow DOM isolation
 */

(function() {
  'use strict';

  // Widget configuration from script tag data attributes
  const SCRIPT_TAG = document.currentScript || document.querySelector('script[data-offerlogix-campaign-id]');
  const CONFIG = {
    campaignId: SCRIPT_TAG?.dataset.offerlogixCampaignId,
    apiUrl: SCRIPT_TAG?.dataset.offerlogixApiUrl || window.location.origin,
    position: SCRIPT_TAG?.dataset.offerlogixPosition || 'bottom-right',
    theme: SCRIPT_TAG?.dataset.offerlogixTheme || 'default',
    autoOpen: SCRIPT_TAG?.dataset.offerlogixAutoOpen === 'true',
    autoOpenDelay: parseInt(SCRIPT_TAG?.dataset.offerlogixAutoOpenDelay || '5000', 10),
    debug: SCRIPT_TAG?.dataset.offerlogixDebug === 'true',
  };

  // Prevent multiple widget instances
  if (window.OfferLogixChat) {
    console.warn('OfferLogix Chat Widget already loaded');
    return;
  }

  class OfferLogixChatWidget {
    constructor() {
      this.campaignId = CONFIG.campaignId;
      this.apiUrl = CONFIG.apiUrl;
      this.sessionToken = null;
      this.isOpen = false;
      this.isInitialized = false;
      this.isMinimized = true;
      this.eventSource = null;
      this.messageQueue = [];
      this.retryCount = 0;
      this.maxRetries = 3;

      // Validate configuration
      if (!this.campaignId) {
        console.error('OfferLogix Chat Widget: campaign ID is required');
        return;
      }

      this.init();
    }

    // =============================================
    // INITIALIZATION
    // =============================================

    async init() {
      try {
        // Create widget container
        this.createWidgetContainer();
        
        // Load widget configuration
        await this.loadWidgetConfig();
        
        // Initialize session
        await this.initializeSession();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Auto-open if configured
        if (CONFIG.autoOpen) {
          setTimeout(() => {
            if (!this.isOpen) {
              this.openChat();
            }
          }, CONFIG.autoOpenDelay);
        }

        this.isInitialized = true;
        this.log('Chat widget initialized successfully');
        
        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('offerLogixChatReady', {
          detail: { widget: this }
        }));
      } catch (error) {
        console.error('OfferLogix Chat Widget initialization failed:', error);
        this.showError('Failed to initialize chat widget');
      }
    }

    createWidgetContainer() {
      // Create main container
      this.container = document.createElement('div');
      this.container.id = 'offerlogix-chat-widget';
      this.container.style.cssText = `
        position: fixed;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ${this.getPositionStyles()}
      `;

      // Create shadow DOM for style isolation
      this.shadowRoot = this.container.attachShadow({ mode: 'closed' });
      
      // Add styles
      this.addStyles();
      
      // Create widget HTML
      this.createWidgetHTML();
      
      // Add to page
      document.body.appendChild(this.container);
    }

    getPositionStyles() {
      const position = CONFIG.position || 'bottom-right';
      const margin = '20px';
      
      switch (position) {
        case 'bottom-right':
          return `bottom: ${margin}; right: ${margin};`;
        case 'bottom-left':
          return `bottom: ${margin}; left: ${margin};`;
        case 'top-right':
          return `top: ${margin}; right: ${margin};`;
        case 'top-left':
          return `top: ${margin}; left: ${margin};`;
        default:
          return `bottom: ${margin}; right: ${margin};`;
      }
    }

    addStyles() {
      const styles = document.createElement('style');
      styles.textContent = `
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .widget-container {
          width: 400px;
          max-width: 90vw;
          height: 600px;
          max-height: 80vh;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          border: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transform: translateY(100%);
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .widget-container.open {
          transform: translateY(0);
          opacity: 1;
        }

        .widget-launcher {
          width: 60px;
          height: 60px;
          background: #0066cc;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3);
          transition: all 0.2s ease;
        }

        .widget-launcher:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 20px rgba(0, 102, 204, 0.4);
        }

        .widget-launcher svg {
          width: 24px;
          height: 24px;
          fill: white;
        }

        .widget-header {
          background: #0066cc;
          color: white;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .widget-title {
          font-weight: 600;
          font-size: 16px;
        }

        .widget-controls {
          display: flex;
          gap: 8px;
        }

        .widget-btn {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          border-radius: 6px;
          padding: 6px;
          cursor: pointer;
          color: white;
          transition: background 0.2s;
        }

        .widget-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .widget-btn svg {
          width: 16px;
          height: 16px;
          fill: currentColor;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          scroll-behavior: smooth;
        }

        .message {
          max-width: 85%;
          padding: 12px 16px;
          border-radius: 18px;
          line-height: 1.4;
          font-size: 14px;
        }

        .message.user {
          background: #0066cc;
          color: white;
          align-self: flex-end;
          border-bottom-right-radius: 4px;
        }

        .message.agent {
          background: #f3f4f6;
          color: #374151;
          align-self: flex-start;
          border-bottom-left-radius: 4px;
          white-space: normal;
        }

        .message.agent p { margin: 8px 0 0 0; }
        .message.agent p:first-child { margin-top: 0; }
        .message.agent ul, .message.agent ol { margin: 8px 0; padding-left: 18px; }
        .message.agent li { margin: 4px 0; }

        .message.system {
          background: #fef3c7;
          color: #92400e;
          align-self: center;
          font-style: italic;
          font-size: 12px;
        }

        .message-time {
          font-size: 10px;
          opacity: 0.6;
          margin-top: 4px;
        }

        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          color: #6b7280;
          font-size: 14px;
        }

        .typing-dots {
          display: flex;
          gap: 4px;
        }

        .typing-dot {
          width: 6px;
          height: 6px;
          background: #9ca3af;
          border-radius: 50%;
          animation: typing 1.4s infinite;
        }

        .typing-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-10px);
            opacity: 1;
          }
        }

        .chat-input-container {
          padding: 16px;
          border-top: 1px solid #e5e7eb;
          background: #fafafa;
        }

        .chat-input-wrapper {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }

        .chat-input {
          flex: 1;
          border: 1px solid #d1d5db;
          border-radius: 20px;
          padding: 12px 16px;
          font-size: 14px;
          resize: none;
          max-height: 100px;
          background: white;
          font-family: inherit;
        }

        .chat-input:focus {
          outline: none;
          border-color: #0066cc;
          box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
        }

        .send-button {
          background: #0066cc;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .send-button:hover:not(:disabled) {
          background: #0052a3;
          transform: scale(1.05);
        }

        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .send-button svg {
          width: 18px;
          height: 18px;
          fill: white;
        }

        .error-message {
          background: #fef2f2;
          color: #dc2626;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          margin: 16px;
          border: 1px solid #fecaca;
        }

        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid #e5e7eb;
          border-top: 2px solid #0066cc;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Mobile responsiveness */
        @media (max-width: 480px) {
          .widget-container {
            width: 100vw;
            height: 100vh;
            border-radius: 0;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
          }
        }

        /* Dark theme */
        .widget-container.dark {
          background: #1f2937;
          border-color: #374151;
        }

        .widget-container.dark .message.agent {
          background: #374151;
          color: #e5e7eb;
        }

        .widget-container.dark .chat-input {
          background: #374151;
          border-color: #4b5563;
          color: #e5e7eb;
        }

        .widget-container.dark .chat-input-container {
          background: #111827;
          border-color: #374151;
        }
      `;
      this.shadowRoot.appendChild(styles);
    }

    createWidgetHTML() {
      const widgetHTML = document.createElement('div');
      widgetHTML.innerHTML = `
        <div class="widget-launcher" id="launcher">
          <svg viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
        </div>
        
        <div class="widget-container" id="widget">
          <div class="widget-header">
            <div class="widget-title">OfferLogix AI Assistant</div>
            <div class="widget-controls">
              <button class="widget-btn" id="minimize" title="Minimize">
                <svg viewBox="0 0 24 24">
                  <path d="M19 13H5v-2h14v2z"/>
                </svg>
              </button>
              <button class="widget-btn" id="close" title="Close">
                <svg viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="chat-messages" id="messages">
            <div class="loading">
              <div class="spinner"></div>
            </div>
          </div>
          
          <div class="chat-input-container">
            <div class="chat-input-wrapper">
              <textarea class="chat-input" id="messageInput" placeholder="Ask me about our offers..." rows="1"></textarea>
              <button class="send-button" id="sendButton" title="Send message">
                <svg viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
      
      this.shadowRoot.appendChild(widgetHTML);
      
      // Get references to elements
      this.launcher = this.shadowRoot.getElementById('launcher');
      this.widget = this.shadowRoot.getElementById('widget');
      this.messagesContainer = this.shadowRoot.getElementById('messages');
      this.messageInput = this.shadowRoot.getElementById('messageInput');
      this.sendButton = this.shadowRoot.getElementById('sendButton');
      this.minimizeButton = this.shadowRoot.getElementById('minimize');
      this.closeButton = this.shadowRoot.getElementById('close');
    }

    // =============================================
    // API COMMUNICATION
    // =============================================

    async loadWidgetConfig() {
      try {
        const response = await fetch(`${this.apiUrl}/api/chat/campaigns/${this.campaignId}/config`);
        if (!response.ok) {
          throw new Error('Failed to load widget configuration');
        }
        
        this.config = await response.json();
        this.applyConfiguration();
      } catch (error) {
        this.log('Config loading failed, using defaults:', error);
        this.config = { campaign: { name: 'OfferLogix Assistant' } };
        this.applyConfiguration();
      }
    }

    applyConfiguration() {
      const { campaign, branding } = this.config;
      
      // Apply theme
      if (branding?.primaryColor) {
        this.applyTheme({ colors: { primary: branding.primaryColor } });
      }
      
      // Update title
      if (campaign?.name) {
        this.shadowRoot.querySelector('.widget-title').textContent = campaign.name;
      }
    }

    applyTheme(theme) {
      if (theme.colors?.primary) {
        const style = document.createElement('style');
        style.textContent = `
          .widget-launcher, .widget-header, .send-button, .message.user {
            background: ${theme.colors.primary} !important;
          }
          .chat-input:focus {
            border-color: ${theme.colors.primary} !important;
            box-shadow: 0 0 0 3px ${theme.colors.primary}20 !important;
          }
        `;
        this.shadowRoot.appendChild(style);
      }
    }

    async initializeSession() {
      const sessionData = {
        visitorId: this.getVisitorId(),
        pageUrl: window.location.href,
        referrer: document.referrer,
        campaignId: this.campaignId,
        metadata: {
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
        },
      };

      try {
        const response = await fetch(`${this.apiUrl}/api/chat/sessions/init`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sessionData),
        });

        if (!response.ok) {
          throw new Error('Failed to initialize chat session');
        }

        const result = await response.json();
        this.sessionToken = result.sessionToken;
        this.sessionId = result.sessionId;
        
        // Display greeting message
        this.displayMessage({
          content: result.greeting || 'Hello! I\'m your OfferLogix AI Assistant. How can I help you find the perfect offer today?',
          senderType: 'agent',
          timestamp: new Date(),
        });
        
        // Clear loading state
        this.messagesContainer.innerHTML = '';
      } catch (error) {
        this.log('Session initialization failed:', error);
        this.messagesContainer.innerHTML = '';
        this.displayMessage({
          content: 'Hello! I\'m your OfferLogix AI Assistant. How can I help you find the perfect offer today?',
          senderType: 'agent',
          timestamp: new Date(),
        });
      }
    }

    async sendMessage(content) {
      // SECURITY: Sanitize user input before sending
      const sanitizedContent = this.sanitizeUserInput(content);
      
      if (!sanitizedContent.trim()) {
        return; // Don't send empty messages
      }

      // Add user message to UI
      this.displayMessage({
        content: sanitizedContent,
        senderType: 'user',
        timestamp: new Date(),
      });

      // Show typing indicator
      this.showTyping(true);

      try {
        const response = await fetch(`${this.apiUrl}/api/chat/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            content: sanitizedContent,
            sessionToken: this.sessionToken,
            campaignId: this.campaignId
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const result = await response.json();
        
        // Hide typing indicator
        this.showTyping(false);
        
        // Display agent response
        this.displayMessage({
          content: result.content || result.message || 'I understand. Let me help you with that.',
          senderType: 'agent',
          timestamp: new Date(),
        });

        // Handle escalation or handover
        if (result.shouldHandover || result.shouldEscalate) {
          this.handleEscalation(result.handoverReason || result.escalationReason);
        }
      } catch (error) {
        this.showTyping(false);
        console.error('Send message error:', error);
        this.displayMessage({
          content: 'Sorry, I encountered an error. Please try again or contact our support team.',
          senderType: 'system',
          timestamp: new Date(),
        });
      }
    }

    // =============================================
    // UI MANAGEMENT
    // =============================================

    displayMessage(message) {
      const messageElement = document.createElement('div');
      messageElement.className = `message ${message.senderType}`;
      
      const content = document.createElement('div');
      
      // SECURITY: Sanitize message content to prevent XSS
      const sanitizedContent = this.sanitizeContent(message.content);
      
      // Use textContent for user messages, innerHTML for agent messages (which are pre-sanitized)
      if (message.senderType === 'user' || message.senderType === 'system') {
        content.textContent = sanitizedContent;
      } else {
        // Agent messages may contain safe HTML formatting
        content.innerHTML = sanitizedContent;
      }
      
      messageElement.appendChild(content);
      
      const time = document.createElement('div');
      time.className = 'message-time';
      time.textContent = this.formatTime(message.timestamp);
      messageElement.appendChild(time);
      
      this.messagesContainer.appendChild(messageElement);
      this.scrollToBottom();
    }

    /**
     * Sanitize content to prevent XSS attacks
     */
    sanitizeContent(content) {
      if (typeof content !== 'string') {
        return '';
      }

      // Remove dangerous elements and attributes
      let sanitized = content
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '')
        .replace(/<object[^>]*>.*?<\/object>/gis, '')
        .replace(/<embed[^>]*>/gi, '')
        .replace(/on\w+\s*=\s*['""][^'"]*['"]/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/vbscript:/gi, '')
        .replace(/data:text\/html/gi, '');

      // Limit allowed HTML tags for agent responses
      const allowedTags = ['b', 'i', 'em', 'strong', 'br', 'p', 'ul', 'ol', 'li'];
      const tagPattern = /<\/?(\w+)[^>]*>/g;

      // Preserve allowed opening/closing tags and strip attributes
      sanitized = sanitized.replace(tagPattern, (match, tagName) => {
        const lower = tagName.toLowerCase();
        if (allowedTags.includes(lower)) {
          const isClosing = match.startsWith('</');
          return isClosing ? `</${lower}>` : `<${lower}>`;
        }
        return '';
      });

      // Convert newlines to readable HTML (paragraphs/line breaks)
      sanitized = sanitized.replace(/\r\n/g, '\n');
      const containsAllowedHtml = /<\/?(p|ul|ol|li|br|strong|em|b|i)\b/i.test(sanitized);
      if (containsAllowedHtml) {
        sanitized = sanitized.replace(/\n/g, '<br>');
      } else {
        const paragraphs = sanitized.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
        if (paragraphs.length > 1) {
          sanitized = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
        } else {
          sanitized = sanitized.replace(/\n/g, '<br>');
        }
      }

      return sanitized;
    }

    /**
     * Sanitize user input before sending to server
     */
    sanitizeUserInput(input) {
      if (typeof input !== 'string') {
        return '';
      }

      // Remove dangerous patterns from user input
      let sanitized = input
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/javascript:/gi, '')
        .replace(/vbscript:/gi, '')
        .replace(/data:/gi, '')
        .replace(/on\w+\s*=/gi, '');

      // Limit input length
      const MAX_MESSAGE_LENGTH = 2000;
      if (sanitized.length > MAX_MESSAGE_LENGTH) {
        sanitized = sanitized.substring(0, MAX_MESSAGE_LENGTH);
      }

      // Remove excessive whitespace
      sanitized = sanitized.replace(/\s+/g, ' ').trim();

      return sanitized;
    }

    showTyping(show) {
      const existingIndicator = this.shadowRoot.querySelector('.typing-indicator');
      
      if (show && !existingIndicator) {
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.innerHTML = `
          <span>AI Assistant is thinking</span>
          <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        `;
        this.messagesContainer.appendChild(indicator);
        this.scrollToBottom();
      } else if (!show && existingIndicator) {
        existingIndicator.remove();
      }
    }

    showError(message) {
      const errorElement = document.createElement('div');
      errorElement.className = 'error-message';
      errorElement.textContent = message;
      this.messagesContainer.appendChild(errorElement);
      this.scrollToBottom();
    }

    scrollToBottom() {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    // =============================================
    // EVENT HANDLING
    // =============================================

    setupEventListeners() {
      // Launcher click
      this.launcher.addEventListener('click', () => this.openChat());
      
      // Control buttons
      this.minimizeButton.addEventListener('click', () => this.minimizeChat());
      this.closeButton.addEventListener('click', () => this.closeChat());
      
      // Send message
      this.sendButton.addEventListener('click', () => this.handleSendMessage());
      
      // Input handling
      this.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
      
      this.messageInput.addEventListener('input', () => {
        this.adjustTextareaHeight();
        this.sendButton.disabled = !this.messageInput.value.trim();
      });
    }

    handleSendMessage() {
      const message = this.messageInput.value.trim();
      if (!message) return;
      
      this.messageInput.value = '';
      this.adjustTextareaHeight();
      this.sendButton.disabled = true;
      
      this.sendMessage(message);
    }

    adjustTextareaHeight() {
      this.messageInput.style.height = 'auto';
      this.messageInput.style.height = `${Math.min(this.messageInput.scrollHeight, 100)}px`;
    }

    openChat() {
      if (!this.isInitialized) return;
      
      this.isOpen = true;
      this.isMinimized = false;
      this.launcher.style.display = 'none';
      this.widget.classList.add('open');
      
      // Focus input
      setTimeout(() => this.messageInput.focus(), 300);
    }

    minimizeChat() {
      this.isMinimized = true;
      this.widget.classList.remove('open');
      this.launcher.style.display = 'flex';
    }

    closeChat() {
      this.isOpen = false;
      this.isMinimized = true;
      this.widget.classList.remove('open');
      this.launcher.style.display = 'flex';
      
      // End session
      if (this.sessionToken) {
        fetch(`${this.apiUrl}/api/chat/sessions/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionToken: this.sessionToken, reason: 'user_closed' }),
        }).catch(console.error);
      }
    }

    handleEscalation(reason) {
      this.displayMessage({
        content: 'I\'ve escalated this conversation to a human specialist. You should receive a personalized response shortly via email.',
        senderType: 'system',
        timestamp: new Date(),
      });
    }

    // =============================================
    // UTILITY METHODS
    // =============================================

    getVisitorId() {
      let visitorId = localStorage.getItem('offerlogix-visitor-id');
      if (!visitorId) {
        visitorId = 'visitor-' + Math.random().toString(36).substr(2, 9) + Date.now();
        localStorage.setItem('offerlogix-visitor-id', visitorId);
      }
      return visitorId;
    }

    formatTime(date) {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    }

    log(...args) {
      if (CONFIG.debug) {
        console.log('[OfferLogix Chat]', ...args);
      }
    }

    // =============================================
    // PUBLIC API
    // =============================================

    // Public methods that can be called from the page
    open() {
      this.openChat();
    }

    close() {
      this.closeChat();
    }

    minimize() {
      this.minimizeChat();
    }

    sendUserMessage(message) {
      if (this.isInitialized && message) {
        this.messageInput.value = message;
        this.handleSendMessage();
      }
    }

    isReady() {
      return this.isInitialized;
    }
  }

  // Initialize widget when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.OfferLogixChat = new OfferLogixChatWidget();
    });
  } else {
    window.OfferLogixChat = new OfferLogixChatWidget();
  }

  // Export for manual initialization
  window.OfferLogixChatWidget = OfferLogixChatWidget;
})();