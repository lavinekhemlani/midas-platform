import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/notifications/dynamodb';
import { NotificationPreferences } from '@/lib/types/notification';
import { getCurrentUser } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let preferences = await NotificationService.getPreferences(user.userId);

    if (!preferences) {
      preferences = await NotificationService.updatePreferences(user.userId, {
        channels: {
          in_app: true,
          email: false,
          sms: false,
          push: false,
        },
        categories: {
          transaction: true,
          alert: true,
          system: true,
          integration: true,
          report: true,
          budget: true,
        },
      });
    }

    return NextResponse.json(preferences);
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const preferences: Partial<NotificationPreferences> = {
      channels: body.channels,
      categories: body.categories,
      quiet_hours: body.quiet_hours,
      frequency: body.frequency,
      thresholds: body.thresholds,
    };

    const updated = await NotificationService.updatePreferences(
      user.userId,
      preferences
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}