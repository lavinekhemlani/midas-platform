import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  BatchWriteCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  Notification,
  NotificationPreferences,
  CreateNotificationInput,
  UpdateNotificationInput,
  NotificationFilter,
  NotificationStats,
  NotificationStatus,
} from '@/lib/types/notification';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.USERS_TABLE_NAME || 'users';

export class NotificationService {
  static async createNotification(input: CreateNotificationInput): Promise<Notification> {
    const notification_id = uuidv4();
    const created_at = Date.now();

    const notification: Notification = {
      PK: `USER#${input.user_id}`,
      SK: `NOTIFICATION#${created_at}#${notification_id}`,
      notification_id,
      user_id: input.user_id,
      type: input.type,
      priority: input.priority || 'medium',
      status: 'unread',
      title: input.title,
      message: input.message,
      icon: input.icon,
      category: input.category,
      actions: input.actions,
      metadata: input.metadata,
      created_at,
    };

    if (input.expires_in_days) {
      const ttlSeconds = Math.floor(created_at / 1000) + (input.expires_in_days * 24 * 60 * 60);
      notification.TTL = ttlSeconds;
      notification.expires_at = ttlSeconds * 1000;
    }

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: notification,
      })
    );

    return notification;
  }

  static async getNotification(user_id: string, notification_id: string): Promise<Notification | null> {
    // Since we don't know the timestamp, we need to query for the notification
    const response = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'notification_id = :notification_id',
        ExpressionAttributeValues: {
          ':pk': `USER#${user_id}`,
          ':sk': 'NOTIFICATION#',
          ':notification_id': notification_id,
        },
        Limit: 1,
      })
    );

    return response.Items?.[0] as Notification | null;
  }

  static async listNotifications(
    user_id: string,
    filter?: NotificationFilter
  ): Promise<{ notifications: Notification[]; lastEvaluatedKey?: any }> {
    const params: any = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${user_id}`,
        ':sk': 'NOTIFICATION#',
      },
      ScanIndexForward: false,
      Limit: filter?.limit || 50,
    };

    if (filter?.last_evaluated_key) {
      params.ExclusiveStartKey = filter.last_evaluated_key;
    }

    const filterExpressions: string[] = [];
    const expressionValues = params.ExpressionAttributeValues;

    if (filter?.type && filter.type.length > 0) {
      filterExpressions.push(`#type IN (${filter.type.map((_, i) => `:type${i}`).join(', ')})`);
      filter.type.forEach((type, i) => {
        expressionValues[`:type${i}`] = type;
      });
      params.ExpressionAttributeNames = { ...params.ExpressionAttributeNames, '#type': 'type' };
    }

    if (filter?.priority && filter.priority.length > 0) {
      filterExpressions.push(`priority IN (${filter.priority.map((_, i) => `:priority${i}`).join(', ')})`);
      filter.priority.forEach((priority, i) => {
        expressionValues[`:priority${i}`] = priority;
      });
    }

    if (filter?.status && filter.status.length > 0) {
      filterExpressions.push(`#status IN (${filter.status.map((_, i) => `:status${i}`).join(', ')})`);
      filter.status.forEach((status, i) => {
        expressionValues[`:status${i}`] = status;
      });
      params.ExpressionAttributeNames = { ...params.ExpressionAttributeNames, '#status': 'status' };
    }

    if (filter?.date_from) {
      filterExpressions.push('created_at >= :date_from');
      expressionValues[':date_from'] = filter.date_from;
    }

    if (filter?.date_to) {
      filterExpressions.push('created_at <= :date_to');
      expressionValues[':date_to'] = filter.date_to;
    }

    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(' AND ');
    }

    const response = await docClient.send(new QueryCommand(params));

    return {
      notifications: (response.Items as Notification[]) || [],
      lastEvaluatedKey: response.LastEvaluatedKey,
    };
  }

  static async updateNotification(
    user_id: string,
    input: UpdateNotificationInput
  ): Promise<Notification | null> {
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};
    const expressionAttributeNames: Record<string, string> = {};

    if (input.status) {
      updateExpressions.push('#status = :status');
      expressionAttributeValues[':status'] = input.status;
      expressionAttributeNames['#status'] = 'status';
    }

    if (input.read_at !== undefined) {
      updateExpressions.push('read_at = :read_at');
      expressionAttributeValues[':read_at'] = input.read_at;
    }

    if (updateExpressions.length === 0) {
      return null;
    }

    // First, find the notification to get its full SK
    const notification = await this.getNotification(user_id, input.notification_id);
    if (!notification) {
      return null;
    }

    const response = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: notification.PK,
          SK: notification.SK,
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0
          ? expressionAttributeNames
          : undefined,
        ReturnValues: 'ALL_NEW',
      })
    );

    return response.Attributes as Notification;
  }

  static async markAsRead(user_id: string, notification_ids: string[]): Promise<void> {
    const now = Date.now();
    const promises = notification_ids.map(id =>
      this.updateNotification(user_id, {
        notification_id: id,
        status: 'read',
        read_at: now,
      })
    );

    await Promise.all(promises);
  }

  static async markAllAsRead(user_id: string): Promise<void> {
    const { notifications } = await this.listNotifications(user_id, {
      status: ['unread'],
      limit: 100,
    });

    if (notifications.length > 0) {
      await this.markAsRead(
        user_id,
        notifications.map(n => n.notification_id)
      );
    }
  }

  static async deleteNotification(user_id: string, notification_id: string): Promise<void> {
    // First, find the notification to get its full SK
    const notification = await this.getNotification(user_id, notification_id);
    if (!notification) {
      return;
    }

    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: notification.PK,
          SK: notification.SK,
        },
      })
    );
  }

  static async archiveNotification(user_id: string, notification_id: string): Promise<Notification | null> {
    return this.updateNotification(user_id, {
      notification_id,
      status: 'archived',
    });
  }

  static async getNotificationStats(user_id: string): Promise<NotificationStats> {
    const { notifications } = await this.listNotifications(user_id, { limit: 100 });

    const stats: NotificationStats = {
      total: notifications.length,
      unread: 0,
      byType: {
        transaction: 0,
        alert: 0,
        system: 0,
        integration: 0,
        report: 0,
        budget: 0,
        general: 0,
      },
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
    };

    notifications.forEach(notification => {
      if (notification.status === 'unread') {
        stats.unread++;
      }
      stats.byType[notification.type]++;
      stats.byPriority[notification.priority]++;
    });

    return stats;
  }

  static async getPreferences(user_id: string): Promise<NotificationPreferences | null> {
    const response = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${user_id}`,
          SK: 'NOTIFICATION_PREFS',
        },
      })
    );

    return response.Item as NotificationPreferences | null;
  }

  static async updatePreferences(
    user_id: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const updated_at = Date.now();

    const item: NotificationPreferences = {
      PK: `USER#${user_id}`,
      SK: 'NOTIFICATION_PREFS',
      user_id,
      channels: preferences.channels || {
        in_app: true,
        email: false,
        sms: false,
        push: false,
      },
      categories: preferences.categories || {
        transaction: true,
        alert: true,
        system: true,
        integration: true,
        report: true,
        budget: true,
      },
      quiet_hours: preferences.quiet_hours,
      frequency: preferences.frequency,
      thresholds: preferences.thresholds,
      updated_at,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );

    return item;
  }

  static async createBulkNotifications(notifications: CreateNotificationInput[]): Promise<void> {
    const items = notifications.map(input => {
      const notification_id = uuidv4();
      const created_at = Date.now();

      const notification: Notification = {
        PK: `USER#${input.user_id}`,
        SK: `NOTIFICATION#${created_at}#${notification_id}`,
        notification_id,
        user_id: input.user_id,
        type: input.type,
        priority: input.priority || 'medium',
        status: 'unread',
        title: input.title,
        message: input.message,
        icon: input.icon,
        category: input.category,
        actions: input.actions,
        metadata: input.metadata,
        created_at,
      };

      if (input.expires_in_days) {
        const ttlSeconds = Math.floor(created_at / 1000) + (input.expires_in_days * 24 * 60 * 60);
        notification.TTL = ttlSeconds;
        notification.expires_at = ttlSeconds * 1000;
      }

      return notification;
    });

    const chunks = [];
    for (let i = 0; i < items.length; i += 25) {
      chunks.push(items.slice(i, i + 25));
    }

    for (const chunk of chunks) {
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: chunk.map(item => ({
              PutRequest: { Item: item },
            })),
          },
        })
      );
    }
  }
}