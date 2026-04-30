import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import server from '@/platform/server';
import type { CustomerService } from '@/platform/services/customer/CustomerService';

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const customerService = server.get<CustomerService>('CustomerService');
    const currentCustomer = await customerService.getCustomer();

    if (!currentCustomer) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!currentCustomer.legalEntityId) {
      return NextResponse.json([], { status: 200 });
    }

    const api = server.get<EmporixApiInvoker>('EmporixApiInvoker');
    const config = server.get('EmporixConfig') as { tenant: string };

    const path = `schema/${config.tenant}/custom-entities/DEVICES/instances`;
    const q = `mixins.ownership.owner.id:${currentCustomer.legalEntityId}`;
    const urlWithQuery = `${path}?q=${encodeURIComponent(q)}`;

    const res = await api.authenticatedFetch(
      urlWithQuery,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Accept-Language': '*',
        },
        cache: 'no-store',
      },
      'service',
      { scopes: ['schema.custominstance_read'] },
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream error' }, { status: res.status });
    }

    const instances = (await res.json()) as Array<any>;

    const data = Array.isArray(instances)
      ? instances.map((it) => {
          const ownership = it?.mixins?.ownership || {};
          return {
            id: it?.id ?? '',
            name: it?.name ?? {},
            productId: ownership.product?.id ?? null,
            companyId: ownership.owner?.id ?? null,
            serialNumber: ownership.serial ?? '',
            health: ownership.health ?? '',
            createdAt: it?.metadata?.createdAt ?? undefined,
            modifiedAt: it?.metadata?.modifiedAt ?? undefined,
          };
        })
      : [];

    return NextResponse.json(data);
  } catch (e) {
    console.error('Failed to fetch devices:', e);
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 });
  }
}
