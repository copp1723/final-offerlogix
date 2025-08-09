import { Router } from 'express';
import { z } from 'zod';
import { userNotificationService, NotificationType } from '../services/user-notification';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Schema for notification preferences
const notificationPreferencesSchema = z.object({
  emailNotifications: z.boolean().default(true),
  campaignAlerts: z.boolean().default(true),
  leadAlerts: z.boolean().default(true),
  systemAlerts: z.boolean().default(true),
  monthlyReports: z.boolean().default(true),
  highEngagementAlerts: z.boolean().default(true),
  quotaWarnings: z.boolean().default(true),
});

// Schema for test notification
const testNotificationSchema = z.object({
  type: z.enum([
    'campaign_executed',
    'campaign_completed', 
    'lead_assigned',
    'high_engagement',
    'system_alert',
    'monthly_report',
    'email_validation_warning',
    'quota_warning'
  ]),
  data: z.record(z.any()).optional().default({}),
});

// Get user notification preferences
router.get('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      preferences: user.notificationPreferences || {
        emailNotifications: true,
        campaignAlerts: true,
        leadAlerts: true,
        systemAlerts: true,
        monthlyReports: true,
        highEngagementAlerts: true,
        quotaWarnings: true
      }
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ message: 'Failed to fetch notification preferences' });
  }
});

// Update user notification preferences  
router.put('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const validatedData = notificationPreferencesSchema.parse(req.body);
    
    const [updatedUser] = await db.update(users)
      .set({ 
        notificationPreferences: validatedData
      } as any)
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      message: 'Notification preferences updated successfully',
      preferences: updatedUser.notificationPreferences
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ message: 'Failed to update notification preferences' });
  }
});

// Send test notification
router.post('/test/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, data } = testNotificationSchema.parse(req.body);
    
    // Check if user exists
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Sample test data for each notification type
    const testData = {
      campaign_executed: {
        campaignName: 'Test Campaign - 2025 Honda Civic',
        campaignId: 'test-campaign-id',
        emailsSent: 25,
        leadsTargeted: 25,
        templateTitle: 'Introduction Email',
        executedAt: new Date(),
        ...data
      },
      campaign_completed: {
        campaignName: 'Test Campaign - 2025 Honda Civic',
        campaignId: 'test-campaign-id',
        totalEmailsSent: 75,
        openRate: 42,
        leadsEngaged: 18,
        duration: '3 weeks',
        ...data
      },
      lead_assigned: {
        leadName: 'John Smith',
        leadEmail: 'john.smith@example.com',
        leadPhone: '(555) 123-4567',
        vehicleInterest: '2025 Honda Civic',
        leadSource: 'website',
        campaignName: 'Test Campaign',
        ...data
      },
      high_engagement: {
        campaignName: 'Test Campaign - 2025 Honda Civic',
        campaignId: 'test-campaign-id',
        openRate: 65,
        clickRate: 15,
        responses: 12,
        engagementScore: 85,
        benchmark: 40,
        ...data
      },
      system_alert: {
        alertTitle: 'System Maintenance Scheduled',
        message: 'A system maintenance window is scheduled for tonight from 2-4 AM EST.',
        details: 'Email sending services may be temporarily unavailable during this time.',
        actionRequired: 'Please avoid scheduling campaigns during the maintenance window.',
        ...data
      },
      monthly_report: {
        month: 'January',
        year: 2025,
        campaignsExecuted: 8,
        totalEmailsSent: 1250,
        newLeads: 45,
        avgOpenRate: 38,
        responseRate: 12,
        conversions: 6,
        ...data
      },
      email_validation_warning: {
        campaignName: 'Test Campaign - 2025 Honda Civic',
        campaignId: 'test-campaign-id',
        issues: [
          'Missing unsubscribe link in template #2',
          'Subject line contains spam trigger words',
          'From email domain not verified'
        ],
        ...data
      },
      quota_warning: {
        percentage: 85,
        emailsSent: 8500,
        emailsQuota: 10000,
        resetDate: 'February 1, 2025',
        ...data
      }
    };
    
    const notificationData = testData[type as keyof typeof testData];
    
    let success = false;
    switch (type) {
      case 'campaign_executed':
        success = await userNotificationService.notifyCampaignExecuted(userId, notificationData as {
          campaignName: string;
          campaignId: string;
          emailsSent: number;
          leadsTargeted: number;
          templateTitle: string;
          executedAt: Date;
        });
        break;
      case 'campaign_completed':
        success = await userNotificationService.notifyCampaignCompleted(userId, notificationData as {
          campaignName: string;
          campaignId: string;
          totalEmailsSent: number;
          openRate: number;
          leadsEngaged: number;
          duration: string;
        });
        break;
      case 'lead_assigned':
        success = await userNotificationService.notifyLeadAssigned(userId, notificationData as {
          leadName: string;
          leadEmail: string;
          leadPhone?: string;
          vehicleInterest?: string;
          leadSource?: string;
          campaignName: string;
        });
        break;
      case 'high_engagement':
        success = await userNotificationService.notifyHighEngagement(userId, notificationData as {
          campaignName: string;
          campaignId: string;
          openRate: number;
          clickRate: number;
          responses: number;
          engagementScore: number;
          benchmark: number;
        });
        break;
      case 'system_alert':
        success = await userNotificationService.sendSystemAlert(userId, notificationData as {
          alertTitle: string;
          message: string;
          details?: string;
          actionRequired?: string;
        });
        break;
      case 'monthly_report':
        success = await userNotificationService.sendMonthlyReport(userId, notificationData as {
          month: string;
          year: number;
          campaignsExecuted: number;
          totalEmailsSent: number;
          newLeads: number;
          avgOpenRate: number;
          responseRate: number;
          conversions: number;
        });
        break;
      case 'email_validation_warning':
        success = await userNotificationService.sendValidationWarning(userId, notificationData as {
          campaignName: string;
          campaignId: string;
          issues: string[];
        });
        break;
      case 'quota_warning':
        success = await userNotificationService.sendQuotaWarning(userId, notificationData as {
          percentage: number;
          emailsSent: number;
          emailsQuota: number;
          resetDate: string;
        });
        break;
    }
    
    if (success) {
      res.json({ 
        message: `Test ${type} notification sent successfully to ${user.email}`,
        type,
        data: notificationData
      });
    } else {
      res.status(500).json({ 
        message: `Failed to send test ${type} notification`,
        type 
      });
    }
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ message: 'Failed to send test notification' });
  }
});

// Get notification types and descriptions
router.get('/types', async (req, res) => {
  const notificationTypes = [
    {
      type: 'campaign_executed',
      name: 'Campaign Executed',
      description: 'Sent when a campaign is successfully executed',
      urgency: 'medium'
    },
    {
      type: 'campaign_completed',
      name: 'Campaign Completed',
      description: 'Sent when a campaign sequence is fully completed',
      urgency: 'low'
    },
    {
      type: 'lead_assigned',
      name: 'Lead Assigned',
      description: 'Sent when a new lead is assigned to a campaign',
      urgency: 'high'
    },
    {
      type: 'high_engagement',
      name: 'High Engagement',
      description: 'Sent when a campaign shows exceptional performance',
      urgency: 'medium'
    },
    {
      type: 'system_alert',
      name: 'System Alert',
      description: 'Important system-wide notifications and alerts',
      urgency: 'high'
    },
    {
      type: 'monthly_report',
      name: 'Monthly Report',
      description: 'Monthly performance summary and analytics',
      urgency: 'low'
    },
    {
      type: 'email_validation_warning',
      name: 'Email Validation Warning',
      description: 'Warnings about email deliverability issues',
      urgency: 'high'
    },
    {
      type: 'quota_warning',
      name: 'Quota Warning',
      description: 'Alerts when approaching usage limits',
      urgency: 'medium'
    }
  ];
  
  res.json({ notificationTypes });
});

export default router;