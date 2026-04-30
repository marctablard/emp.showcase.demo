import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import server from '@/platform/server';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

const PROJECT_MIXIN_KEY = 'project';
const PROJECT_MIXIN_SCHEMA = 'https://res.cloudinary.com/saas-ag/raw/upload/schemata2/showcasedemo/project_v1.json';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listId: string; itemId: string }> },
) {
  const logger = server.get<LoggerService>('LoggerService');
  try {
    const { id: projectId } = await params;
    const body = await request.json().catch(() => ({}));
    // productIdToRemove is sent in the body to avoid URL-encoding issues with special chars in product IDs
    const { listName = '', currentItems = [], productIdToRemove = '' } = body;

    const api = server.get<EmporixApiInvoker>('EmporixApiInvoker');
    const config = server.get('EmporixConfig') as { tenant: string };
    const customerService = server.get<CustomerService>('CustomerService');
    const customer = await customerService.getCustomer();

    if (!customer?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!productIdToRemove) {
      return NextResponse.json({ error: 'productIdToRemove is required' }, { status: 400 });
    }

    // Filter out the target item by productId; strip to API-required fields only
    const updatedItems = currentItems
      .filter((i: any) => String(i.productId) !== String(productIdToRemove))
      .map((i: any) => ({ productId: i.productId, quantity: i.quantity }));

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
        { productIdToRemove, customerId: customer.id, status: putRes.status, body: errorBody },
        'DELETE shopping list item failed',
      );
      return NextResponse.json(
        { error: `Failed to remove item: ${putRes.status} ${errorBody}` },
        { status: putRes.status },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Error removing shopping list item',
    );
    return NextResponse.json({ error: 'Failed to remove item' }, { status: 500 });
  }
}
