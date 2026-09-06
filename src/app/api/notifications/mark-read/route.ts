import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/notifications/dynamodb';
import { getCurrentUser } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notification_ids, mark_all } = body;

    if (mark_all) {
      await NotificationService.markAllAsRead(user.userId);
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (!notification_ids || !Array.isArray(notification_ids)) {
      return NextResponse.json(
        { error: 'notification_ids array is required' },
        { status: 400 }
      );
    }

    await NotificationService.markAsRead(user.userId, notification_ids);

    return NextResponse.json({ success: true, message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}