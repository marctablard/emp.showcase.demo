import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { QuoteAddItemNotificationService } from '@/platform/services/quote-add-item-notification/QuoteAddItemNotificationService';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!id?.trim()) {
    return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
  }

  try {
    const customerService = server.get<CustomerService>('CustomerService');
    const currentCustomer = await customerService.getCustomer();
    if (!currentCustomer?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const notificationService = server.get<QuoteAddItemNotificationService>('QuoteAddItemNotificationService');
    const notification = await notificationService.getNotification(id.trim());

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const customerId = notification.customerId?.trim();
    if (customerId && customerId !== currentCustomer.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ notification });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/quote/add-item-notifications/[id]',
        method: 'GET',
        notificationId: id,
      },
      'Error fetching quote add-item notification',
    );
    const message = error instanceof Error ? error.message : 'Failed to fetch notification';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
