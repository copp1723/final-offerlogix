/**
 * Real-time Security Alerts System
 * Monitors security events and generates alerts
 */

import { Request, Response } from 'express';
import { db } from '../db';
import { securityEvents } from '../../shared/schema';
import { eq, desc, gte, and } from 'drizzle-orm';

export interface SecurityAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: string;
  source: string;
  metadata?: any;
}

interface AlertRule {
  id: string;
  name: string;
  condition: (events: any[]) => boolean;
  severity: 'warning' | 'error' | 'info';
  message: string;
  cooldownMinutes: number;
}

class SecurityAlertsManager {
  private static instance: SecurityAlertsManager;
  private alertRules: AlertRule[] = [];
  private lastAlertTimes: Map<string, Date> = new Map();

  private constructor() {
    this.initializeAlertRules();
  }

  static getInstance(): SecurityAlertsManager {
    if (!SecurityAlertsManager.instance) {
      SecurityAlertsManager.instance = new SecurityAlertsManager();
    }
    return SecurityAlertsManager.instance;
  }

  private initializeAlertRules(): void {
    this.alertRules = [
      {
        id: 'multiple_failed_logins',
        name: 'Multiple Failed Login Attempts',
        condition: (events) => {
          const failedLogins = events.filter(e => 
            e.eventType === 'AUTH_FAILURE' && 
            e.timestamp > new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
          );
          return failedLogins.length >= 5;
        },
        severity: 'warning',
        message: 'Multiple failed login attempts detected',
        cooldownMinutes: 30
      },
      {
        id: 'rate_limit_exceeded',
        name: 'High Rate Limit Violations',
        condition: (events) => {
          const rateLimitEvents = events.filter(e => 
            e.eventType === 'RATE_LIMIT_EXCEEDED' && 
            e.timestamp > new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
          );
          return rateLimitEvents.length >= 10;
        },
        severity: 'error',
        message: 'High number of rate limit violations detected',
        cooldownMinutes: 15
      },
      {
        id: 'suspicious_ip_activity',
        name: 'Suspicious IP Activity',
        condition: (events) => {
          const ipGroups = new Map<string, number>();
          events
            .filter(e => e.timestamp > new Date(Date.now() - 60 * 60 * 1000)) // Last hour
            .forEach(e => {
              const ip = e.metadata?.ip || 'unknown';
              ipGroups.set(ip, (ipGroups.get(ip) || 0) + 1);
            });
          
          // Check if any IP has more than 100 events in an hour
          return Array.from(ipGroups.values()).some(count => count >= 100);
        },
        severity: 'warning',
        message: 'Suspicious activity from specific IP addresses',
        cooldownMinutes: 60
      },
      {
        id: 'attack_patterns',
        name: 'Attack Pattern Detection',
        condition: (events) => {
          const attackEvents = events.filter(e => 
            ['XSS_ATTEMPT', 'SQL_INJECTION_ATTEMPT', 'PATH_TRAVERSAL_ATTEMPT'].includes(e.eventType) &&
            e.timestamp > new Date(Date.now() - 30 * 60 * 1000) // Last 30 minutes
          );
          return attackEvents.length >= 3;
        },
        severity: 'error',
        message: 'Potential attack patterns detected',
        cooldownMinutes: 60
      },
      {
        id: 'admin_access_attempts',
        name: 'Unauthorized Admin Access',
        condition: (events) => {
          const adminAttempts = events.filter(e => 
            e.eventType === 'UNAUTHORIZED_ACCESS' && 
            e.metadata?.resource?.includes('admin') &&
            e.timestamp > new Date(Date.now() - 60 * 60 * 1000) // Last hour
          );
          return adminAttempts.length >= 3;
        },
        severity: 'error',
        message: 'Unauthorized admin access attempts detected',
        cooldownMinutes: 30
      }
    ];
  }

  async checkForAlerts(): Promise<SecurityAlert[]> {
    try {
      // Get recent security events (last 24 hours)
      const recentEvents = await db
        .select()
        .from(securityEvents)
        .where(gte(securityEvents.timestamp, new Date(Date.now() - 24 * 60 * 60 * 1000)))
        .orderBy(desc(securityEvents.timestamp));

      const alerts: SecurityAlert[] = [];

      for (const rule of this.alertRules) {
        // Check cooldown
        const lastAlert = this.lastAlertTimes.get(rule.id);
        if (lastAlert && Date.now() - lastAlert.getTime() < rule.cooldownMinutes * 60 * 1000) {
          continue;
        }

        // Check condition
        if (rule.condition(recentEvents)) {
          const alert: SecurityAlert = {
            id: `${rule.id}_${Date.now()}`,
            type: rule.severity,
            message: rule.message,
            timestamp: new Date().toISOString(),
            source: 'Security Monitor',
            metadata: { rule: rule.name }
          };

          alerts.push(alert);
          this.lastAlertTimes.set(rule.id, new Date());

          // Log the alert as a security event
          await this.logAlert(alert);
        }
      }

      return alerts;
    } catch (error) {
      console.error('Error checking for security alerts:', error);
      return [];
    }
  }

  private async logAlert(alert: SecurityAlert): Promise<void> {
    try {
      await db.insert(securityEvents).values({
        eventType: 'SECURITY_ALERT',
        severity: alert.type,
        message: alert.message,
        source: alert.source,
        metadata: alert.metadata,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error logging security alert:', error);
    }
  }

  async getRecentAlerts(limit: number = 50): Promise<SecurityAlert[]> {
    try {
      const alertEvents = await db
        .select()
        .from(securityEvents)
        .where(eq(securityEvents.eventType, 'SECURITY_ALERT'))
        .orderBy(desc(securityEvents.timestamp))
        .limit(limit);

      return alertEvents.map(event => ({
        id: event.id,
        type: event.severity as 'warning' | 'error' | 'info',
        message: event.message,
        timestamp: event.timestamp.toISOString(),
        source: 'Security Monitor',
        metadata: event.metadata
      }));
    } catch (error) {
      console.error('Error fetching recent alerts:', error);
      return [];
    }
  }

  // Add custom alert rule
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
  }

  // Remove alert rule
  removeAlertRule(ruleId: string): void {
    this.alertRules = this.alertRules.filter(rule => rule.id !== ruleId);
  }

  // Get alert statistics
  async getAlertStats(): Promise<any> {
    try {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [alerts24h, alerts7d] = await Promise.all([
        db
          .select()
          .from(securityEvents)
          .where(and(
            eq(securityEvents.eventType, 'SECURITY_ALERT'),
            gte(securityEvents.timestamp, last24Hours)
          )),
        db
          .select()
          .from(securityEvents)
          .where(and(
            eq(securityEvents.eventType, 'SECURITY_ALERT'),
            gte(securityEvents.timestamp, last7Days)
          ))
      ]);

      const severityCount = alerts24h.reduce((acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        last24Hours: alerts24h.length,
        last7Days: alerts7d.length,
        severityBreakdown: severityCount,
        activeRules: this.alertRules.length,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting alert stats:', error);
      return {
        last24Hours: 0,
        last7Days: 0,
        severityBreakdown: {},
        activeRules: this.alertRules.length,
        lastCheck: new Date().toISOString()
      };
    }
  }
}

// Singleton instance
const alertsManager = SecurityAlertsManager.getInstance();

// API endpoints
export async function getSecurityAlerts(req: Request, res: Response): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const alerts = await alertsManager.getRecentAlerts(limit);
    
    res.json({
      alerts,
      total: alerts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching security alerts:', error);
    res.status(500).json({
      error: 'Failed to fetch security alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function triggerAlertCheck(req: Request, res: Response): Promise<void> {
  try {
    const alerts = await alertsManager.checkForAlerts();
    
    res.json({
      newAlerts: alerts,
      count: alerts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error triggering alert check:', error);
    res.status(500).json({
      error: 'Failed to check for alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function getAlertStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = await alertsManager.getAlertStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching alert stats:', error);
    res.status(500).json({
      error: 'Failed to fetch alert statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Background monitoring service
export class SecurityMonitoringService {
  private static instance: SecurityMonitoringService;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  static getInstance(): SecurityMonitoringService {
    if (!SecurityMonitoringService.instance) {
      SecurityMonitoringService.instance = new SecurityMonitoringService();
    }
    return SecurityMonitoringService.instance;
  }

  start(intervalMinutes: number = 5): void {
    if (this.isRunning) {
      console.log('Security monitoring already running');
      return;
    }

    console.log(`🔍 Starting security monitoring (checking every ${intervalMinutes} minutes)`);
    
    this.monitoringInterval = setInterval(async () => {
      try {
        const alerts = await alertsManager.checkForAlerts();
        if (alerts.length > 0) {
          console.log(`🚨 Generated ${alerts.length} security alerts`);
          // Here you could integrate with external alerting systems
          // like Slack, email, PagerDuty, etc.
        }
      } catch (error) {
        console.error('Security monitoring error:', error);
      }
    }, intervalMinutes * 60 * 1000);

    this.isRunning = true;
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Security monitoring stopped');
  }

  getStatus(): { running: boolean; nextCheck?: string } {
    return {
      running: this.isRunning,
      nextCheck: this.isRunning ? 'Running' : 'Stopped'
    };
  }
}

export { alertsManager };