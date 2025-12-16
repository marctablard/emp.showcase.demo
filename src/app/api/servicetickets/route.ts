import { NextRequest, NextResponse } from 'next/server';
import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import type { EmporixCustomerApi } from '@/platform/integrations/emporix/customer/EmporixCustomerApi';
import server from '@/platform/server';
import type { CustomerService } from '@/platform/services/customer/CustomerService';

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const customerService = server.get<CustomerService>('CustomerService');
    const currentCustomer = await customerService.getCustomer();

    if (!currentCustomer) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const api = server.get<EmporixApiInvoker>('EmporixApiInvoker');
    const config = server.get('EmporixConfig') as { tenant: string };

    // Fetch raw Emporix customer profile to read customerNumber
    const customerApi = server.get<EmporixCustomerApi>('EmporixCustomerApi');
    const profile = await customerApi.getCustomerProfile();
    const customerNumber = profile?.customerNumber || '';
    const customerIdentifier = customerNumber || currentCustomer.id;

    const path = `schema/${config.tenant}/custom-entities/SERVICETICKETS/instances`;
    const q = `mixins.ticketinfo.ticketcustomer:${customerIdentifier}`;
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
          const info = it?.mixins?.ticketinfo || {};
          return {
            Status: info.ticketstatus ?? 'open',
            OrderID: info.ticketorder ?? null,
            OwnerID: info.ticketowner ?? null,
            TicketID: it?.id ?? '',
            TicketName: it?.name?.en ?? it?.name?.de ?? it?.id ?? '',
            ProductID: info.ticketproduct ?? null,
            SubjectID: info.ticketsubject ?? null,
            CustomerID: info.ticketcustomer ?? null,
            Description: {
              en: info.ticketdescription ?? undefined,
              de: info.ticketdescription ?? undefined,
            },
            SubjectName: {
              en: undefined,
              de: undefined,
            },
            CreatedAt: it?.metadata?.createdAt ?? undefined,
          };
        })
      : [];

    return NextResponse.json(data);
  } catch (e) {
    console.error('Failed to fetch service tickets:', e);
    return NextResponse.json({ error: 'Failed to fetch service tickets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.subjectId || !body.descriptionEn) {
      return NextResponse.json({ error: 'Subject and description are required' }, { status: 400 });
    }

    // Get DI services
    const api = server.get<EmporixApiInvoker>('EmporixApiInvoker');
    const config = server.get('EmporixConfig') as { tenant: string };
    const customerApi = server.get<EmporixCustomerApi>('EmporixCustomerApi');

    // Determine customer number for ticketcustomer
    const profile = await customerApi.getCustomerProfile();
    const customerNumber = profile?.customerNumber;

    // Generate TicketID and TicketName
    const guid = crypto.randomUUID().replace(/-/g, '');
    const ticketId = `ST-${guid}`;
    const ticketName = ticketId.substring(0, 10);

    // Build payload
    const payload = {
      name: {
        en: ticketName,
      },
      mixins: {
        ticketinfo: {
          ticketcustomer: body.customerId || customerNumber || '',
          ticketdescription: body.descriptionEn,
          ticketowner: '',
          ticketstatus: 'open',
          ticketsubject: body.subjectId,
          ...(body.orderId ? { ticketorder: body.orderId } : {}),
          ...(body.productId ? { ticketproduct: body.productId } : {}),
        },
      },
    };

    const putUrl = `schema/${config.tenant}/custom-entities/SERVICETICKETS/instances/${encodeURIComponent(ticketId)}`;

    const res = await api.authenticatedFetch(
      putUrl,
      {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      'service',
      { scopes: ['schema.custominstance_manage'] },
    );

    if (!res.ok && res.status !== 204 && res.status !== 201) {
      return NextResponse.json({ error: 'Upstream error' }, { status: res.status });
    }

    return NextResponse.json({ id: ticketId, name: { en: ticketName } }, { status: res.status === 201 ? 201 : 200 });
  } catch (e) {
    console.error('Failed to create service ticket:', e);
    return NextResponse.json({ error: 'Failed to create service ticket' }, { status: 500 });
  }
}
