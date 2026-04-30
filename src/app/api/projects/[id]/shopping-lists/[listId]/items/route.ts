import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import server from '@/platform/server';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

const PROJECT_MIXIN_KEY = 'project';
const PROJECT_MIXIN_SCHEMA = 'https://res.cloudinary.com/saas-ag/raw/upload/schemata2/showcasedemo/project_v1.json';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; listId: string }> }) {
  const logger = server.get<LoggerService>('LoggerService');
  try {
    const { id: projectId, listId } = await params;
    const body = await request.json();
    const { productId, quantity = 1, listName = '', currentItems = [] } = body;

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const api = server.get<EmporixApiInvoker>('EmporixApiInvoker');
    const config = server.get('EmporixConfig') as { tenant: string };
    const customerService = server.get<CustomerService>('CustomerService');
    const customer = await customerService.getCustomer();

    if (!customer?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Append the new item; strip to the API-required fields only
    const updatedItems = [
      ...currentItems.map((i: any) => ({ productId: i.productId, quantity: i.quantity })),
      { productId, quantity },
    ];

    // Always preserve the project mixin so the list stays linked to its project
    const putBody = {
      name: listName,
      items: updatedItems,
      mixins: { [PROJECT_MIXIN_KEY]: { projectid: projectId } },
      metadata: { mixins: { [PROJECT_MIXIN_KEY]: PROJECT_MIXIN_SCHEMA } },
    };

    const putRes = await api.authenticatedFetch(
      `shoppinglist/${config.tenant}/shopping-lists/${customer.id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody),
      },
      'session',
    );

    if (!putRes.ok) {
      const errorBody = await putRes.text();
      logger.error(
        { listId, productId, customerId: customer.id, status: putRes.status, body: errorBody },
        'PUT shopping list items failed',
      );
      return NextResponse.json(
        { error: `Failed to add item: ${putRes.status} ${errorBody}` },
        { status: putRes.status },
      );
    }

    return NextResponse.json({ productId, quantity, id: '' }, { status: 201 });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Error adding item to shopping list',
    );
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
  }
}
