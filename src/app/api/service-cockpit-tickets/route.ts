import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import type { EmporixCustomerApi } from '@/platform/integrations/emporix/customer/EmporixCustomerApi';
import server from '@/platform/server';
import type { CustomerService } from '@/platform/services/customer/CustomerService';

const SERVICE_COCKPIT_TICKET_TYPE = 'product_ordering_issue';

const SERVICE_COCKPIT_TICKET_MIXIN_SCHEMA_URL =
  'https://res.cloudinary.com/saas-ag/raw/upload/schemata2/cockpitsdev/serviceCockpitTicket_v2.json';

function generateTicketId(): string {
  return `TKT-${Date.now()}${Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const customerService = server.get<CustomerService>('CustomerService');
    const currentCustomer = await customerService.getCustomer();

    if (!currentCustomer) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = (await request.json()) as {
      subject?: string;
      summary?: string;
      businessImpact?: string;
      productId?: string;
      quantity?: number;
    };

    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
    const businessImpact = typeof body.businessImpact === 'string' ? body.businessImpact.trim() : '';
    const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
    const quantity = typeof body.quantity === 'number' && Number.isFinite(body.quantity) ? body.quantity : NaN;

    if (!subject || !summary || !businessImpact || !productId || !Number.isInteger(quantity) || quantity < 1) {
      return NextResponse.json(
        { error: 'Subject, summary, business impact, product id, and a positive quantity are required' },
        { status: 400 },
      );
    }

    const customerApi = server.get<EmporixCustomerApi>('EmporixCustomerApi');
    const profile = await customerApi.getCustomerProfile();
    const customerNumber = profile?.customerNumber;
    const customerId = customerNumber || currentCustomer.id;
    const companyId = currentCustomer.legalEntityId || '';

    const api = server.get<EmporixApiInvoker>('EmporixApiInvoker');
    const config = server.get('EmporixConfig') as { tenant: string };

    const id = generateTicketId();

    const payload = {
      id,
      name: {
        en: subject,
      },
      mixins: {
        serviceCockpitTicket: {
          businessImpact,
          companyId,
          customerId,
          summary,
          type: SERVICE_COCKPIT_TICKET_TYPE,
          properties: {
            ProductId: productId,
            Quantity: quantity,
          },
          feedback: {
            comment: '',
            score: 0,
          },
          sla: {
            firstReactionTime: '',
            resolutionTime: '',
            status: '',
          },
          messages: [],
          interactions: [],
        },
      },
      metadata: {
        mixins: {
          serviceCockpitTicket: SERVICE_COCKPIT_TICKET_MIXIN_SCHEMA_URL,
        },
      },
    };

    const path = `schema/${config.tenant}/custom-entities/SERVICE_COCKPIT_TICKET/instances`;

    const res = await api.authenticatedFetch(
      path,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      'service',
      { scopes: ['schema.custominstance_manage'] },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Service cockpit ticket upstream error:', res.status, text);
      return NextResponse.json({ error: 'Upstream error', detail: text }, { status: res.status });
    }

    let data: unknown;
    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await res.json();
    }

    return NextResponse.json(data ?? { id }, { status: res.status === 204 ? 200 : res.status });
  } catch (e) {
    console.error('Failed to create service cockpit ticket:', e);
    return NextResponse.json({ error: 'Failed to create service cockpit ticket' }, { status: 500 });
  }
}
