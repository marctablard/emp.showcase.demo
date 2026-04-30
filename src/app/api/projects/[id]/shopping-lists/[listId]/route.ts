import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import server from '@/platform/server';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; listId: string }> }) {
  const logger = server.get<LoggerService>('LoggerService');
  try {
    const { listId } = await params;
    const body = await request.json().catch(() => ({}));
    const listName: string = body.listName ?? '';

    const api = server.get<EmporixApiInvoker>('EmporixApiInvoker');
    const config = server.get('EmporixConfig') as { tenant: string };
    const customerService = server.get<CustomerService>('CustomerService');
    const customer = await customerService.getCustomer();

    if (!customer?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // DELETE uses customer ID in path; list is identified by name query param
    let url = `shoppinglist/${config.tenant}/shopping-lists/${customer.id}`;
    if (listName) url += `?name=${encodeURIComponent(listName)}`;

    const res = await api.authenticatedFetch(url, { method: 'DELETE' }, 'session');

    if (!res.ok) {
      const errorBody = await res.text();
      logger.error(
        { listId, customerId: customer.id, status: res.status, body: errorBody },
        'DELETE shopping list failed',
      );
      return NextResponse.json(
        { error: `Failed to delete shopping list: ${res.status} ${errorBody}` },
        { status: res.status },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error deleting shopping list');
    return NextResponse.json({ error: 'Failed to delete shopping list' }, { status: 500 });
  }
}
