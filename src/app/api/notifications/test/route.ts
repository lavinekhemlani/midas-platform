import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/notifications/dynamodb';
import { NotificationTriggers } from '@/lib/notifications/triggers';
import { getCurrentUser } from '@/lib/auth-utils';
import { CreateNotificationInput } from '@/lib/types/notification';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create various test notifications
    const testNotifications: CreateNotificationInput[] = [
      {
        user_id: user.userId,
        type: 'alert',
        priority: 'high',
        title: '⚠️ Low Cash Balance Alert',
        message: 'Your cash balance of $12,450 is below the threshold of $15,000. Consider reviewing your cash flow projections.',
        icon: 'alert-triangle',
        category: 'financial',
        actions: [
          { label: 'View Cash Flow', url: '/dashboard/cashflow' },
          { label: 'Review Forecast', url: '/analytics/forecast' },
        ],
        metadata: {
          balance: 12450,
          threshold: 15000,
        },
        expires_in_days: 7,
      },
      {
        user_id: user.userId,
        type: 'transaction',
        priority: 'medium',
        title: '💰 Large Transaction Detected',
        message: 'A payment of $48,500 was received from Acme Corp. This exceeds your alert threshold.',
        icon: 'dollar-sign',
        category: 'financial',
        actions: [
          { label: 'View Transaction', url: '/transactions/123' },
        ],
        metadata: {
          amount: 48500,
          party: 'Acme Corp',
        },
        expires_in_days: 30,
      },
      {
        user_id: user.userId,
        type: 'integration',
        priority: 'high',
        title: '🔗 QuickBooks Integration Needs Attention',
        message: 'Your QuickBooks connection needs to be re-authenticated. Please reconnect to continue syncing.',
        icon: 'link-off',
        category: 'system',
        actions: [
          { label: 'Reconnect', url: '/settings' },
        ],
        metadata: {
          integration: 'QuickBooks',
        },
      },
      {
        user_id: user.userId,
        type: 'report',
        priority: 'low',
        title: '📊 Monthly Financial Report Ready',
        message: 'Your November 2024 financial report has been generated and is ready for viewing.',
        icon: 'file-text',
        category: 'report',
        actions: [
          { label: 'View Report', url: '/reports/nov-2024' },
          { label: 'Download PDF', url: '/api/reports/nov-2024/download' },
        ],
        metadata: {
          report_type: 'Monthly Financial',
          month: 'November',
          year: 2024,
        },
        expires_in_days: 90,
      },
      {
        user_id: user.userId,
        type: 'budget',
        priority: 'medium',
        title: '💸 Marketing Budget Exceeded',
        message: "You've exceeded your Marketing budget by 15.2%. Spent: $11,520 / Budget: $10,000",
        icon: 'piggy-bank',
        category: 'financial',
        actions: [
          { label: 'Review Budget', url: '/budget' },
        ],
        metadata: {
          category: 'Marketing',
          spent: 11520,
          budget: 10000,
          percentage_over: 15.2,
        },
        expires_in_days: 7,
      },
      {
        user_id: user.userId,
        type: 'transaction',
        priority: 'critical',
        title: '📅 Invoice Payment Overdue',
        message: 'Invoice #INV-2024-089 for $5,750 is now 5 days overdue. Customer: TechStart Inc.',
        icon: 'clock',
        category: 'financial',
        actions: [
          { label: 'View Invoice', url: '/invoices/INV-2024-089' },
          { label: 'Send Reminder', action: 'send_reminder' },
        ],
        metadata: {
          invoice_number: 'INV-2024-089',
          amount: 5750,
          customer: 'TechStart Inc',
          days_overdue: 5,
        },
        expires_in_days: 1,
      },
      {
        user_id: user.userId,
        type: 'system',
        priority: 'low',
        title: '✅ Data Sync Completed',
        message: 'Successfully synced 1,247 records from QuickBooks.',
        icon: 'refresh',
        category: 'system',
        metadata: {
          provider: 'QuickBooks',
          records_processed: 1247,
        },
        expires_in_days: 3,
      },
      {
        user_id: user.userId,
        type: 'alert',
        priority: 'high',
        title: '🚨 Unusual Activity Detected',
        message: 'Multiple large withdrawals detected in the last hour. Please review for accuracy.',
        icon: 'alert-circle',
        category: 'security',
        actions: [
          { label: 'Review Activity', url: '/transactions?filter=today' },
          { label: 'Mark as Expected', action: 'dismiss_anomaly' },
        ],
        metadata: {
          anomaly_type: 'withdrawal_pattern',
          confidence: 0.87,
        },
        expires_in_days: 1,
      },
      {
        user_id: user.userId,
        type: 'general',
        priority: 'low',
        title: '👋 Welcome to Midas Notifications!',
        message: 'Your notification system is now active. You will receive real-time alerts about important financial events.',
        icon: 'info',
        category: 'system',
        expires_in_days: 30,
      },
    ];

    // Create notifications in batch
    await NotificationService.createBulkNotifications(testNotifications);

    return NextResponse.json({
      success: true,
      message: `Created ${testNotifications.length} test notifications`,
      count: testNotifications.length
    });
  } catch (error) {
    console.error('Error creating test notifications:', error);
    return NextResponse.json(
      { error: 'Failed to create test notifications' },
      { status: 500 }
    );
  }
}