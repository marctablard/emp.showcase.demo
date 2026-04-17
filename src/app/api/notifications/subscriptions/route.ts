import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { NotificationService } from '@/platform/services/notification/NotificationService';

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
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/notifications/subscriptions',
        method: 'PUT',
      },
      'Error validating subscription',
    );
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
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/notifications/subscriptions',
        method: 'DELETE',
      },
      'Error removing subscription',
    );
    return NextResponse.json({ success: false, message: 'Failed to remove subscription' }, { status: 500 });
  }
}
