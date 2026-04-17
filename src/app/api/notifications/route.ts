import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { StorefrontNotification } from '@/platform/services/model/notification/notification';
import type { NotificationService } from '@/platform/services/notification/NotificationService';

/**
 * GET handler for fetching notifications
 * @param request The incoming request
 * @returns Response with notifications
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Get the notification service from the container
    const notificationService = server.get<NotificationService>('NotificationService');

    if (!notificationService) {
      return NextResponse.json({ error: 'Notification service not available' }, { status: 500 });
    }

    const notifications: StorefrontNotification[] = await notificationService.getAllContextNotifications();

    return NextResponse.json({ notifications });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/notifications',
        method: 'GET',
      },
      'Error fetching notifications',
    );
    return NextResponse.json(
      { error: `Failed to fetch notifications: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}

/**
 * POST handler for sending push notifications for a specific notification
 * @param request The incoming request
 * @returns Response indicating success or failure
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let notificationId: string | undefined;

  try {
    const body = await request.json();
    notificationId = body.notificationId;

    if (!notificationId) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
    }

    // Get the notification service from the container
    const notificationService = server.get<NotificationService>('NotificationService');

    if (!notificationService) {
      return NextResponse.json({ error: 'Notification service not available' }, { status: 500 });
    }

    // Send push notification to all subscriptions for this notification
    await notificationService.sendPushNotification(notificationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/notifications',
        method: 'POST',
        notificationId,
      },
      'Error sending push notification',
    );
    return NextResponse.json(
      { error: `Failed to send push notification: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}

/**
 * DELETE handler for deleting a notification
 * @param request The incoming request
 * @returns Response indicating success or failure
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
    }

    // Get the notification service from the container
    const notificationService = server.get<NotificationService>('NotificationService');

    if (!notificationService) {
      return NextResponse.json({ error: 'Notification service not available' }, { status: 500 });
    }

    await notificationService.deleteNotification(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    const id = request.nextUrl.searchParams.get('id');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/notifications',
        method: 'DELETE',
        notificationId: id,
      },
      'Error deleting notification',
    );
    return NextResponse.json(
      { error: `Failed to delete notification: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
