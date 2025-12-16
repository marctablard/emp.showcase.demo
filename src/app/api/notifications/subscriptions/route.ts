import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { NotificationService } from '@/platform/services/notification/NotificationService';

/**
 * POST handler to store a push subscription
 */
export async function PUT(request: NextRequest) {
  try {
    const body: PushSubscription = await request.json();

    if (!body) {
      return NextResponse.json({ success: false, message: 'Invalid subscription data' }, { status: 400 });
    }

    // Get the notification service from the container
    const notificationService = server.get<NotificationService>('NotificationService');

    if (!notificationService) {
      return NextResponse.json({ error: 'Notification service not available' }, { status: 500 });
    }
    // Store the subscription using the notification service
    await notificationService.subscribe(body);
  } catch (error) {
    console.error('Error validating subscription:', error);
    return NextResponse.json({ success: false, message: 'Invalid subscription' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE handler to remove a push subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.subscription) {
      return NextResponse.json({ success: false, message: 'Invalid subscription data' }, { status: 400 });
    }

    // Get the notification service from the container
    const notificationService = server.get<NotificationService>('NotificationService');

    if (!notificationService) {
      return NextResponse.json({ error: 'Notification service not available' }, { status: 500 });
    }

    // Remove the subscription using the notification service
    await notificationService.unsubscribe(body.subscription);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing subscription:', error);
    return NextResponse.json({ success: false, message: 'Failed to remove subscription' }, { status: 500 });
  }
}
