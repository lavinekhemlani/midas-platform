import { NotificationService } from './dynamodb';
import { CreateNotificationInput } from '@/lib/types/notification';

export class NotificationTriggers {
  static async onLowCashBalance(userId: string, balance: number, threshold: number) {
    const notification: CreateNotificationInput = {
      user_id: userId,
      type: 'alert',
      priority: 'high',
      title: 'Low Cash Balance Alert',
      message: `Your cash balance of $${balance.toLocaleString()} is below the threshold of $${threshold.toLocaleString()}. Consider reviewing your cash flow projections.`,
      icon: 'alert-triangle',
      category: 'financial',
      actions: [
        {
          label: 'View Cash Flow',
          url: '/dashboard/cashflow',
        },
        {
          label: 'Review Forecast',
          url: '/analytics/forecast',
        },
      ],
      metadata: {
        balance,
        threshold,
        alert_type: 'low_cash_balance',
      },
      expires_in_days: 7,
    };

    return NotificationService.createNotification(notification);
  }

  static async onLargeTransaction(userId: string, transaction: any, threshold: number) {
    const notification: CreateNotificationInput = {
      user_id: userId,
      type: 'transaction',
      priority: 'medium',
      title: 'Large Transaction Detected',
      message: `A transaction of $${Math.abs(transaction.amount).toLocaleString()} was ${transaction.amount > 0 ? 'received from' : 'sent to'} ${transaction.party}. This exceeds your alert threshold.`,
      icon: 'dollar-sign',
      category: 'financial',
      actions: [
        {
          label: 'View Transaction',
          url: `/transactions/${transaction.id}`,
        },
      ],
      metadata: {
        transaction_id: transaction.id,
        amount: transaction.amount,
        party: transaction.party,
        threshold,
      },
      expires_in_days: 30,
    };

    return NotificationService.createNotification(notification);
  }

  static async onIntegrationDisconnected(userId: string, integration: string) {
    const notification: CreateNotificationInput = {
      user_id: userId,
      type: 'integration',
      priority: 'high',
      title: 'Integration Disconnected',
      message: `Your ${integration} integration has been disconnected. Please reconnect to continue syncing your financial data.`,
      icon: 'link-off',
      category: 'system',
      actions: [
        {
          label: 'Reconnect',
          url: `/settings`,
        },
      ],
      metadata: {
        integration,
        disconnected_at: Date.now(),
      },
    };

    return NotificationService.createNotification(notification);
  }

  static async onReportReady(userId: string, reportType: string, reportId: string) {
    const notification: CreateNotificationInput = {
      user_id: userId,
      type: 'report',
      priority: 'low',
      title: `${reportType} Report Ready`,
      message: `Your ${reportType.toLowerCase()} report has been generated and is ready for viewing.`,
      icon: 'file-text',
      category: 'report',
      actions: [
        {
          label: 'View Report',
          url: `/reports/${reportId}`,
        },
        {
          label: 'Download PDF',
          url: `/api/reports/${reportId}/download`,
        },
      ],
      metadata: {
        report_id: reportId,
        report_type: reportType,
        generated_at: Date.now(),
      },
      expires_in_days: 90,
    };

    return NotificationService.createNotification(notification);
  }

  static async onBudgetExceeded(userId: string, category: string, spent: number, budget: number) {
    const percentageOver = ((spent - budget) / budget * 100).toFixed(1);

    const notification: CreateNotificationInput = {
      user_id: userId,
      type: 'budget',
      priority: 'medium',
      title: 'Budget Exceeded',
      message: `You've exceeded your ${category} budget by ${percentageOver}%. Spent: $${spent.toLocaleString()} / Budget: $${budget.toLocaleString()}`,
      icon: 'piggy-bank',
      category: 'financial',
      actions: [
        {
          label: 'Review Budget',
          url: '/budget',
        },
      ],
      metadata: {
        category,
        spent,
        budget,
        percentage_over: percentageOver,
      },
      expires_in_days: 7,
    };

    return NotificationService.createNotification(notification);
  }

  static async onPaymentDue(userId: string, invoice: any, daysUntilDue: number) {
    const priority = daysUntilDue <= 1 ? 'critical' : daysUntilDue <= 3 ? 'high' : 'medium';

    const notification: CreateNotificationInput = {
      user_id: userId,
      type: 'transaction',
      priority,
      title: 'Payment Due Soon',
      message: `Invoice #${invoice.number} for $${invoice.amount.toLocaleString()} is due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}. Customer: ${invoice.customer}`,
      icon: 'clock',
      category: 'financial',
      actions: [
        {
          label: 'View Invoice',
          url: `/invoices/${invoice.id}`,
        },
        {
          label: 'Send Reminder',
          action: 'send_reminder',
        },
      ],
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.number,
        amount: invoice.amount,
        customer: invoice.customer,
        due_date: invoice.due_date,
        days_until_due: daysUntilDue,
      },
      expires_in_days: daysUntilDue + 1,
    };

    return NotificationService.createNotification(notification);
  }

  static async onSyncCompleted(userId: string, provider: string, recordsProcessed: number) {
    const notification: CreateNotificationInput = {
      user_id: userId,
      type: 'system',
      priority: 'low',
      title: 'Data Sync Completed',
      message: `Successfully synced ${recordsProcessed.toLocaleString()} records from ${provider}.`,
      icon: 'refresh',
      category: 'system',
      metadata: {
        provider,
        records_processed: recordsProcessed,
        synced_at: Date.now(),
      },
      expires_in_days: 3,
    };

    return NotificationService.createNotification(notification);
  }

  static async onAnomalyDetected(userId: string, anomaly: any) {
    const notification: CreateNotificationInput = {
      user_id: userId,
      type: 'alert',
      priority: 'high',
      title: 'Unusual Activity Detected',
      message: `We've detected unusual ${anomaly.type} activity: ${anomaly.description}. Please review for accuracy.`,
      icon: 'alert-circle',
      category: 'security',
      actions: [
        {
          label: 'Review Activity',
          url: anomaly.review_url,
        },
        {
          label: 'Mark as Expected',
          action: 'dismiss_anomaly',
        },
      ],
      metadata: {
        anomaly_type: anomaly.type,
        anomaly_id: anomaly.id,
        confidence: anomaly.confidence,
      },
      expires_in_days: 14,
    };

    return NotificationService.createNotification(notification);
  }

  static async createBatchDailyNotifications(userId: string, metrics: any) {
    const notifications: CreateNotificationInput[] = [];

    if (metrics.cash_balance < metrics.low_balance_threshold) {
      notifications.push({
        user_id: userId,
        type: 'alert',
        priority: 'high',
        title: 'Daily Cash Balance Alert',
        message: `Today's cash balance: $${metrics.cash_balance.toLocaleString()}`,
        expires_in_days: 1,
      });
    }

    if (metrics.pending_invoices > 0) {
      notifications.push({
        user_id: userId,
        type: 'transaction',
        priority: 'medium',
        title: 'Pending Invoices',
        message: `You have ${metrics.pending_invoices} invoice${metrics.pending_invoices === 1 ? '' : 's'} pending payment.`,
        expires_in_days: 1,
      });
    }

    if (notifications.length > 0) {
      await NotificationService.createBulkNotifications(notifications);
    }

    return notifications.length;
  }
}