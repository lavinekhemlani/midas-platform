import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/notifications/dynamodb';
import { CreateNotificationInput, NotificationFilter } from '@/lib/types/notification';
import { getCurrentUser } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;

    const filter: NotificationFilter = {};

    const type = searchParams.get('type');
    if (type) {
      filter.type = type.split(',') as any[];
    }

    const priority = searchParams.get('priority');
    if (priority) {
      filter.priority = priority.split(',') as any[];
    }

    const status = searchParams.get('status');
    if (status) {
      filter.status = status.split(',') as any[];
    }

    const limit = searchParams.get('limit');
    if (limit) {
      filter.limit = parseInt(limit, 10);
    }

    const dateFrom = searchParams.get('date_from');
    if (dateFrom) {
      filter.date_from = parseInt(dateFrom, 10);
    }

    const dateTo = searchParams.get('date_to');
    if (dateTo) {
      filter.date_to = parseInt(dateTo, 10);
    }

    const lastKey = searchParams.get('last_key');
    if (lastKey) {
      filter.last_evaluated_key = JSON.parse(decodeURIComponent(lastKey));
    }

    const result = await NotificationService.listNotifications(user.userId, filter);

    return NextResponse.json({
      notifications: result.notifications,
      lastEvaluatedKey: result.lastEvaluatedKey,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const input: CreateNotificationInput = {
      user_id: user.userId,
      type: body.type || 'general',
      priority: body.priority,
      title: body.title,
      message: body.message,
      icon: body.icon,
      category: body.category,
      actions: body.actions,
      metadata: body.metadata,
      expires_in_days: body.expires_in_days,
    };

    const notification = await NotificationService.createNotification(input);

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notification_id, status, read_at } = body;

    if (!notification_id) {
      return NextResponse.json(
        { error: 'notification_id is required' },
        { status: 400 }
      );
    }

    const updated = await NotificationService.updateNotification(user.userId, {
      notification_id,
      status,
      read_at,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}