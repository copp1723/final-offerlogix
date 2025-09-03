import { DeliverabilityMonitor } from '../../server/services/deliverability/deliverability-monitor';

describe('DeliverabilityMonitor', () => {
  let monitor: DeliverabilityMonitor;

  beforeEach(() => {
    monitor = new DeliverabilityMonitor();
  });

  afterEach(() => {
    monitor.reset();
  });

  describe('recordSend', () => {
    it('tracks send events for a domain', () => {
      monitor.recordSend('example.com');
      const metrics = monitor.getDomainMetrics('example.com');
      expect(metrics.sent).toBe(1);
    });

    it('handles empty domain gracefully', () => {
      monitor.recordSend('');
      const metrics = monitor.getAllMetrics();
      expect(Object.keys(metrics)).toHaveLength(0);
    });
  });

  describe('recordBounce', () => {
    it('tracks bounce events for a domain', () => {
      monitor.recordSend('example.com');
      monitor.recordBounce('example.com');
      const metrics = monitor.getDomainMetrics('example.com');
      expect(metrics.bounces).toBe(1);
      expect(metrics.bounceRate).toBe(1.0); // 100%
    });
  });

  describe('recordComplaint', () => {
    it('tracks complaint events for a domain', () => {
      monitor.recordSend('example.com');
      monitor.recordComplaint('example.com');
      const metrics = monitor.getDomainMetrics('example.com');
      expect(metrics.complaints).toBe(1);
      expect(metrics.complaintRate).toBe(1.0); // 100%
    });
  });

  describe('recordDelivery', () => {
    it('tracks delivery events and timing', () => {
      monitor.recordSend('example.com');
      monitor.recordDelivery('example.com', 500); // 500ms delivery time
      const metrics = monitor.getDomainMetrics('example.com');
      expect(metrics.deliveries).toBe(1);
      expect(metrics.deliveryRate).toBe(1.0);
      expect(metrics.avgDeliveryMs).toBe(500);
    });
  });

  describe('shouldSlowdown', () => {
    it('returns false for healthy domains', () => {
      monitor.recordSend('example.com');
      monitor.recordDelivery('example.com');
      expect(monitor.shouldSlowdown('example.com')).toBe(false);
    });

    it('returns true for domains with high bounce rates', () => {
      // Record multiple sends to get above threshold
      for (let i = 0; i < 20; i++) {
        monitor.recordSend('example.com');
      }
      // Record bounces to exceed 5% threshold
      for (let i = 0; i < 2; i++) {
        monitor.recordBounce('example.com');
      }
      
      const metrics = monitor.getDomainMetrics('example.com');
      expect(metrics.bounceRate).toBeGreaterThanOrEqual(0.05);
      expect(monitor.shouldSlowdown('example.com')).toBe(true);
    });

    it('returns true for domains with high complaint rates', () => {
      // Record multiple sends
      for (let i = 0; i < 200; i++) {
        monitor.recordSend('example.com');
      }
      // Record complaints to exceed 0.5% threshold
      for (let i = 0; i < 2; i++) {
        monitor.recordComplaint('example.com');
      }
      
      const metrics = monitor.getDomainMetrics('example.com');
      expect(metrics.complaintRate).toBeGreaterThanOrEqual(0.005);
      expect(monitor.shouldSlowdown('example.com')).toBe(true);
    });
  });

  describe('getRecommendedDelay', () => {
    it('returns 0 for healthy domains', () => {
      monitor.recordSend('example.com');
      monitor.recordDelivery('example.com');
      expect(monitor.getRecommendedDelay('example.com')).toBe(0);
    });

    it('returns positive delay for problematic domains', () => {
      // Create high bounce rate scenario
      for (let i = 0; i < 20; i++) {
        monitor.recordSend('example.com');
      }
      for (let i = 0; i < 2; i++) {
        monitor.recordBounce('example.com');
      }
      
      expect(monitor.getRecommendedDelay('example.com')).toBeGreaterThan(0);
    });
  });

  describe('getHealthSummary', () => {
    it('categorizes domains correctly', () => {
      // Healthy domain
      monitor.recordSend('healthy.com');
      monitor.recordDelivery('healthy.com');

      // Warning domain (above bounce threshold 5% but below alert threshold 10%)
      for (let i = 0; i < 100; i++) {
        monitor.recordSend('warning.com');
      }
      for (let i = 0; i < 7; i++) {
        monitor.recordBounce('warning.com'); // 7% bounce rate - between 5% and 10%
      }

      // Critical domain (above alert threshold 10%)
      for (let i = 0; i < 100; i++) {
        monitor.recordSend('critical.com');
      }
      for (let i = 0; i < 15; i++) {
        monitor.recordBounce('critical.com'); // 15% bounce rate - above 10%
      }

      const summary = monitor.getHealthSummary();
      expect(summary.totalDomains).toBe(3);
      expect(summary.healthyDomains).toBe(1);
      expect(summary.warningDomains).toBe(1);
      expect(summary.criticalDomains).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('removes old metrics', () => {
      monitor.recordSend('old.com');
      
      // Mock old timestamp
      const metrics = monitor.getDomainMetrics('old.com');
      // @ts-ignore - accessing private property for testing
      const domainMetrics = monitor.metrics.get('old.com');
      if (domainMetrics) {
        domainMetrics.lastEventAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      }

      monitor.cleanup(24); // Clean metrics older than 24 hours
      const allMetrics = monitor.getAllMetrics();
      expect(Object.keys(allMetrics)).toHaveLength(0);
    });
  });

  describe('applySendRate', () => {
    it('does not delay for healthy domains', async () => {
      monitor.recordSend('example.com');
      monitor.recordDelivery('example.com');
      
      const start = Date.now();
      await monitor.applySendRate('example.com');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100); // Should be nearly instant
    });

    it('applies delay for problematic domains', async () => {
      // Create high bounce rate scenario
      for (let i = 0; i < 20; i++) {
        monitor.recordSend('example.com');
      }
      for (let i = 0; i < 2; i++) {
        monitor.recordBounce('example.com');
      }
      
      const start = Date.now();
      await monitor.applySendRate('example.com');
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThan(0); // Should have some delay
    }, 10000); // Increase timeout for this test
  });
});