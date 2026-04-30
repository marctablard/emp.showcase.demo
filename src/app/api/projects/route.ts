import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { resolveLegalEntityIdFromSessionAndCustomer } from '@/lib/common/legal-entity-context';
import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import server from '@/platform/server';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ProjectCreateDto } from '@/platform/services/model/project/project';
import type { SessionService } from '@/platform/services/session/SessionService';

const ENTITY_TYPE = 'PROJECTS';
const MIXIN_KEY = 'projectinfo';
const MIXIN_SCHEMA_URL = 'https://res.cloudinary.com/saas-ag/raw/upload/schemata2/showcasedemo/projectinfo_v2.json';

export async function GET() {
  const logger = server.get<LoggerService>('LoggerService');
  try {
    const customerService = server.get<CustomerService>('CustomerService');
    const customer = await customerService.getCustomer();

    if (!customer) {
      logger.warn({}, 'GET /api/projects: no authenticated customer');
      return NextResponse.json([]);
    }

    const sessionService = server.get<SessionService>('SessionService');
    const session = await sessionService.getCurrent();
    const legalEntityId = resolveLegalEntityIdFromSessionAndCustomer(session, customer);

    logger.info({ customerId: customer.id, legalEntityId }, 'GET /api/projects: fetching all project instances');

    const api = server.get<EmporixApiInvoker>('EmporixApiInvoker');
    const config = server.get('EmporixConfig') as { tenant: string };

    const res = await api.authenticatedFetch(
      `schema/${config.tenant}/custom-entities/${ENTITY_TYPE}/instances?pageSize=200`,
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
      const errorBody = await res.text();
      logger.error({ status: res.status, body: errorBody }, 'GET /api/projects: Emporix API error');
      return NextResponse.json({ error: `Emporix API error: ${res.status} ${errorBody}` }, { status: res.status });
    }

    const instances = await res.json();
    logger.info(
      { count: Array.isArray(instances) ? instances.length : 'not-array' },
      'GET /api/projects: raw instances returned',
    );

    if (!Array.isArray(instances)) {
      logger.error({ instances }, 'GET /api/projects: response is not an array');
      return NextResponse.json([]);
    }

    // Filter to show only projects belonging to this customer's company (session-aware)
    const filtered = instances.filter((it: any) => {
      const info = it?.mixins?.[MIXIN_KEY];
      if (!info) return false;
      if (legalEntityId) {
        return info.company?.id === legalEntityId;
      }
      return info.customer?.id === customer.id;
    });

    logger.info(
      { total: instances.length, filtered: filtered.length, legalEntityId },
      'GET /api/projects: filtered results',
    );

    const projects = filtered.map((it: any) => {
      const info = it?.mixins?.[MIXIN_KEY] ?? {};
      return {
        id: it?.id ?? '',
        name: it?.name ?? {},
        status: info.status ?? 'open',
        startDate: info.datestart ?? undefined,
        endDate: info.dateend ?? undefined,
        comment: info.comment ?? undefined,
        customerId: info.customer?.id ?? '',
        companyId: info.company?.id ?? '',
        mediaIds: it?.media ?? [],
        createdAt: it?.metadata?.createdAt ?? undefined,
        modifiedAt: it?.metadata?.modifiedAt ?? undefined,
      };
    });

    return NextResponse.json(projects);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'GET /api/projects: unexpected error',
    );
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const logger = server.get<LoggerService>('LoggerService');
  try {
    const customerService = server.get<CustomerService>('CustomerService');
    const customer = await customerService.getCustomer();

    if (!customer) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body: ProjectCreateDto = await request.json();

    if (!body.name || !body.status) {
      return NextResponse.json({ error: 'name and status are required' }, { status: 400 });
    }

    const api = server.get<EmporixApiInvoker>('EmporixApiInvoker');
    const config = server.get('EmporixConfig') as { tenant: string };

    const nameMap = body.name as Record<string, string>;
    const payload = {
      name: { en: nameMap?.en ?? Object.values(nameMap)[0] ?? '' },
      mixins: {
        [MIXIN_KEY]: {
          status: body.status,
          ...(body.startDate ? { datestart: body.startDate } : {}),
          ...(body.endDate ? { dateend: body.endDate } : {}),
          comment: body.comment ?? '',
          customer: { emporixReferenceType: 'CUSTOMER', id: customer.id },
          ...(customer.legalEntityId
            ? { company: { emporixReferenceType: 'COMPANY', id: customer.legalEntityId } }
            : {}),
        },
      },
      metadata: {
        mixins: {
          [MIXIN_KEY]: MIXIN_SCHEMA_URL,
        },
      },
    };

    logger.info({ customerId: customer.id, payload }, 'POST /api/projects: creating project');

    const contentLanguage = 'en';
    const res = await api.authenticatedFetch(
      `schema/${config.tenant}/custom-entities/${ENTITY_TYPE}/instances?validateReferences=false`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Language': contentLanguage,
        },
        body: JSON.stringify(payload),
      },
      'service',
      { scopes: ['schema.custominstance_manage'] },
    );

    if (!res.ok) {
      const errorBody = await res.text();
      logger.error({ status: res.status, body: errorBody }, 'POST /api/projects: Emporix API error');
      return NextResponse.json(
        { error: `Failed to create project: ${res.status} ${errorBody}` },
        { status: res.status },
      );
    }

    const { id } = await res.json();
    logger.info({ id }, 'POST /api/projects: project created');

    // Fetch the created entity to return a full project object
    const getRes = await api.authenticatedFetch(
      `schema/${config.tenant}/custom-entities/${ENTITY_TYPE}/instances/${id}`,
      { method: 'GET', headers: { Accept: 'application/json', 'Accept-Language': '*' }, cache: 'no-store' },
      'service',
      { scopes: ['schema.custominstance_read'] },
    );

    if (!getRes.ok) {
      // Return minimal response if re-fetch fails
      return NextResponse.json({ id, name: body.name, status: body.status }, { status: 201 });
    }

    const entity = await getRes.json();
    const info = entity?.mixins?.[MIXIN_KEY] ?? {};
    const project = {
      id: entity.id,
      name: entity.name ?? body.name,
      status: info.status ?? body.status,
      startDate: info.datestart ?? undefined,
      endDate: info.dateend ?? undefined,
      comment: info.comment ?? undefined,
      customerId: info.customer?.id ?? customer.id,
      companyId: info.company?.id ?? customer.legalEntityId ?? '',
      mediaIds: entity.media ?? [],
      createdAt: entity.metadata?.createdAt ?? undefined,
      modifiedAt: entity.metadata?.modifiedAt ?? undefined,
    };

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'POST /api/projects: unexpected error',
    );
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
