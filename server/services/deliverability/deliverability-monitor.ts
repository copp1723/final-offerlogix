import logger from '../../logging/logger';

interface DomainMetrics {
  domain: string;
  sent: number;
  bounces: number;
  complaints: number;
  deliveries: number;
  deliveryTimes: number[];
  lastEventAt?: Date;
  alerted: boolean;
}

/**
 * Enhanced Deliverability Monitor
 * Tracks domain-level email metrics and applies adaptive rate limiting
 */
export class DeliverabilityMonitor {
  private metrics: Map<string, DomainMetrics> = new Map();
  private bounceThreshold: number;
  private complaintThreshold: number;
  private slowdownMs: number;
  private alertThreshold: number;

  constructor() {
    // Configurable thresholds via environment variables
    this.bounceThreshold = Number(process.env.DELIVERABILITY_BOUNCE_THRESHOLD ?? 0.05); // 5%
    this.complaintThreshold = Number(process.env.DELIVERABILITY_COMPLAINT_THRESHOLD ?? 0.005); // 0.5%
    this.slowdownMs = Number(process.env.DELIVERABILITY_SLOWDOWN_MS ?? 60000); // 1 minute
    this.alertThreshold = Number(process.env.DELIVERABILITY_ALERT_THRESHOLD ?? 0.1); // 10%
  }

  private getOrCreate(domain: string): DomainMetrics {
    if (!this.metrics.has(domain)) {
      this.metrics.set(domain, {
        domain,
        sent: 0,
        bounces: 0,
        complaints: 0,
        deliveries: 0,
        deliveryTimes: [],
        alerted: false
      });
    }
    return this.metrics.get(domain)!;
  }

  recordSend(domain: string): void {
    if (!domain) return;
    const stats = this.getOrCreate(domain);
    stats.sent++;
    stats.lastEventAt = new Date();
  }

  recordBounce(domain: string): void {
    if (!domain) return;
    const stats = this.getOrCreate(domain);
    stats.bounces++;
    stats.lastEventAt = new Date();
    this.checkAlerts(domain);
  }

  recordComplaint(domain: string): void {
    if (!domain) return;
    const stats = this.getOrCreate(domain);
    stats.complaints++;
    stats.lastEventAt = new Date();
    this.checkAlerts(domain);
  }

  recordDelivery(domain: string, deliveryTimeMs: number = 0): void {
    if (!domain) return;
    const stats = this.getOrCreate(domain);
    stats.deliveries++;
    if (deliveryTimeMs > 0) {
      stats.deliveryTimes.push(deliveryTimeMs);
      // Keep only last 100 delivery times for memory efficiency
      if (stats.deliveryTimes.length > 100) {
        stats.deliveryTimes = stats.deliveryTimes.slice(-100);
      }
    }
    stats.lastEventAt = new Date();
  }

  getDomainMetrics(domain: string): DomainMetrics & { 
    bounceRate: number; 
    complaintRate: number; 
    deliveryRate: number;
    avgDeliveryMs: number;
  } {
    const stats = this.getOrCreate(domain);
    const bounceRate = stats.sent > 0 ? stats.bounces / stats.sent : 0;
    const complaintRate = stats.sent > 0 ? stats.complaints / stats.sent : 0;
    const deliveryRate = stats.sent > 0 ? stats.deliveries / stats.sent : 0;
    const avgDeliveryMs = stats.deliveryTimes.length > 0
      ? stats.deliveryTimes.reduce((a, b) => a + b, 0) / stats.deliveryTimes.length
      : 0;

    return { ...stats, bounceRate, complaintRate, deliveryRate, avgDeliveryMs };
  }

  shouldSlowdown(domain: string): boolean {
    const { bounceRate, complaintRate } = this.getDomainMetrics(domain);
    return bounceRate >= this.bounceThreshold || complaintRate >= this.complaintThreshold;
  }

  getRecommendedDelay(domain: string): number {
    if (this.shouldSlowdown(domain)) {
      const { bounceRate, complaintRate } = this.getDomainMetrics(domain);
      // Progressive delay based on severity
      const severity = Math.max(bounceRate, complaintRate * 20); // Weight complaints higher
      return Math.min(this.slowdownMs * 3, Math.ceil(severity * this.slowdownMs));
    }
    return 0;
  }

  async applySendRate(domain: string): Promise<void> {
    const delay = this.getRecommendedDelay(domain);
    if (delay > 0) {
      logger.warn(`Applying deliverability slowdown for ${domain}`, { 
        delay, 
        metrics: this.getDomainMetrics(domain) 
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  private checkAlerts(domain: string): void {
    const stats = this.getDomainMetrics(domain);
    if (stats.alerted) return;

    if (stats.bounceRate >= this.alertThreshold || stats.complaintRate >= this.complaintThreshold) {
      stats.alerted = true;
      this.sendAlert(domain, stats).catch((err) =>
        logger.error('Failed to send deliverability alert', { domain, error: err })
      );
    }
  }

  private async sendAlert(domain: string, stats: { bounceRate: number; complaintRate: number; sent: number }): Promise<void> {
    const message = `🚨 Deliverability Alert: ${domain}\n` +
      `• Bounce Rate: ${(stats.bounceRate * 100).toFixed(2)}%\n` +
      `• Complaint Rate: ${(stats.complaintRate * 100).toFixed(2)}%\n` +
      `• Total Sent: ${stats.sent} emails`;

    // Log alert locally
    logger.warn(message.replace(/\n/g, ' '), { domain, stats });

    // Send to Slack if configured
    const slackWebhook = process.env.SLACK_WEBHOOK_URL;
    if (slackWebhook) {
      try {
        const response = await fetch(slackWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: message,
            username: 'MailMind Deliverability',
            emoji: '🚨'
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Slack API returned ${response.status}`);
        }
        
        logger.info('Deliverability alert sent to Slack', { domain });
      } catch (err) {
        logger.error('Failed to send Slack deliverability alert', { domain, error: err });
      }
    }
  }

  getAllMetrics(): Record<string, ReturnType<typeof this.getDomainMetrics>> {
    const result: Record<string, ReturnType<typeof this.getDomainMetrics>> = {};
    for (const domain of this.metrics.keys()) {
      result[domain] = this.getDomainMetrics(domain);
    }
    return result;
  }

  getHealthSummary(): {
    totalDomains: number;
    healthyDomains: number;
    warningDomains: number;
    criticalDomains: number;
  } {
    const domains = Array.from(this.metrics.keys());
    let healthy = 0, warning = 0, critical = 0;

    for (const domain of domains) {
      const { bounceRate, complaintRate } = this.getDomainMetrics(domain);
      
      if (bounceRate >= this.alertThreshold || complaintRate >= this.complaintThreshold) {
        critical++;
      } else if (bounceRate >= this.bounceThreshold || complaintRate >= this.complaintThreshold) {
        warning++;
      } else {
        healthy++;
      }
    }

    return {
      totalDomains: domains.length,
      healthyDomains: healthy,
      warningDomains: warning,
      criticalDomains: critical
    };
  }

  reset(): void {
    this.metrics.clear();
  }

  // Cleanup old metrics to prevent memory leaks
  cleanup(olderThanHours: number = 24): void {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    for (const [domain, stats] of this.metrics.entries()) {
      if (stats.lastEventAt && stats.lastEventAt < cutoff) {
        this.metrics.delete(domain);
      }
    }
  }
}

export const deliverabilityMonitor = new DeliverabilityMonitor();

// Auto-cleanup every hour
setInterval(() => {
  deliverabilityMonitor.cleanup();
}, 60 * 60 * 1000);