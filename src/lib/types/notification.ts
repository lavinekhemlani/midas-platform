// Notification types for the ZenithOS notification system

export type NotificationType =
  | 'transaction'
  | 'alert'
  | 'system'
  | 'integration'
  | 'report'
  | 'budget'
  | 'general';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export type NotificationStatus = 'unread' | 'read' | 'archived';

export interface NotificationAction {
  label: string;
  url?: string;
  action?: string;
}

export interface Notification {
  PK: `USER#${string}`;
  SK: `NOTIFICATION#${string}`;

  notification_id: string;
  user_id: string;

  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;

  title: string;
  message: string;

  icon?: string;
  category?: string;

  actions?: NotificationAction[];

  metadata?: {
    amount?: number;
    currency?: string;
    account_id?: string;
    integration_id?: string;
    report_id?: string;
    transaction_id?: string;
    [key: string]: any;
  };

  created_at: number;
  read_at?: number;
  expires_at?: number;

  TTL?: number;
}

export interface NotificationPreferences {
  PK: `USER#${string}`;
  SK: 'NOTIFICATION_PREFS';

  user_id: string;

  channels: {
    in_app: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
  };

  categories: {
    transaction: boolean;
    alert: boolean;
    system: boolean;
    integration: boolean;
    report: boolean;
    budget: boolean;
  };

  quiet_hours?: {
    enabled: boolean;
    start_time: string;
    end_time: string;
    timezone: string;
  };

  frequency?: {
    immediate: string[];
    daily_digest: string[];
    weekly_summary: string[];
  };

  thresholds?: {
    low_balance_alert: number;
    large_transaction: number;
    budget_warning_percentage: number;
  };

  updated_at: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
}

export interface CreateNotificationInput {
  user_id: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  icon?: string;
  category?: string;
  actions?: NotificationAction[];
  metadata?: Record<string, any>;
  expires_in_days?: number;
}

export interface UpdateNotificationInput {
  notification_id: string;
  status?: NotificationStatus;
  read_at?: number;
}

export interface NotificationFilter {
  type?: NotificationType[];
  priority?: NotificationPriority[];
  status?: NotificationStatus[];
  date_from?: number;
  date_to?: number;
  limit?: number;
  last_evaluated_key?: any;
}