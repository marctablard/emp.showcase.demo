import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ProjectUpdateDto } from '@/platform/services/model/project/project';

const ENTITY_TYPE = 'PROJECTS';
const MIXIN_KEY = 'projectinfo';
const MIXIN_SCHEMA_URL = 'https://res.cloudinary.com/saas-ag/raw/upload/schemata2/showcasedemo/projectinfo_v2.json';

function mapEntity(entity: any) {
  const info = entity?.mixins?.[MIXIN_KEY] ?? {};
  return {
    id: entity.id,
    name: entity.name ?? {},
    status: info.status ?? 'open',
    startDate: info.datestart ?? undefined,
    endDate: info.dateend ?? undefined,
    comment: info.comment ?? undefined,
    customerId: info.customer?.id ?? '',
    companyId: info.company?.id ?? '',
    mediaIds: entity.media ?? [],
    createdAt: entity.metadata?.createdAt ?? undefined,
    modifiedAt: entity.metadata?.modifiedAt ?? undefined,
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const logger = server.get<LoggerService>('LoggerService');
  try {
    const { id } = await params;
    const api = server.get<EmporixApiInvoker>('EmporixApiInvoker');
    const config = server.get('EmporixConfig') as { tenant: string };

    const res = await api.authenticatedFetch(
      `schema/${config.tenant}/custom-entities/${ENTITY_TYPE}/instances/${id}`,
      { method: 'GET', headers: { Accept: 'application/json', 'Accept-Language': '*' }, cache: 'no-store' },
      'service',
      { scopes: ['schema.custominstance_read'] },
    );

    if (!res.ok) {
      if (res.status === 404) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      const errorBody = await res.text();
      logger.error({ id, status: res.status, body: errorBody }, 'GET /api/projects/[id]: Emporix error');
      return NextResponse.json({ error: `Emporix error: ${res.status} ${errorBody}` }, { status: res.status });
    }

    return NextResponse.json(mapEntity(await res.json()));
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'GET /api/projects/[id]: error');
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const logger = server.get<LoggerService>('LoggerService');
  try {
    const { id } = await params;
    const body: ProjectUpdateDto = await request.json();
    const api = server.get<EmporixApiInvoker>('EmporixApiInvoker');
    const config = server.get('EmporixConfig') as { tenant: string };

    // Fetch existing entity first
    const getRes = await api.authenticatedFetch(
      `schema/${config.tenant}/custom-entities/${ENTITY_TYPE}/instances/${id}`,
      { method: 'GET', headers: { Accept: 'application/json', 'Accept-Language': '*' }, cache: 'no-store' },
      'service',
      { scopes: ['schema.custominstance_read'] },
    );

    if (!getRes.ok) {
      if (getRes.status === 404) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      const errorBody = await getRes.text();
      logger.error({ id, status: getRes.status, body: errorBody }, 'PUT /api/projects/[id]: fetch existing failed');
      return NextResponse.json(
        { error: `Failed to fetch project: ${getRes.status} ${errorBody}` },
        { status: getRes.status },
      );
    }

    const existing = await getRes.json();
    const existingInfo = existing?.mixins?.[MIXIN_KEY] ?? {};

    const existingNameEn =
      (existing.name as Record<string, string>)?.en ?? (existing.name as Record<string, string>)?.de ?? '';
    const incomingNameEn = body.name
      ? ((body.name as Record<string, string>)?.en ?? Object.values(body.name as Record<string, string>)[0] ?? '')
      : undefined;
    const resolvedName = { en: incomingNameEn ?? existingNameEn };

    const updated = {
      ...existing,
      name: resolvedName,
      mixins: {
        ...existing.mixins,
        [MIXIN_KEY]: {
          ...existingInfo,
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.startDate !== undefined ? { datestart: body.startDate } : {}),
          ...(body.endDate !== undefined ? { dateend: body.endDate } : {}),
          ...(body.comment !== undefined ? { comment: body.comment } : {}),
        },
      },
      metadata: {
        ...existing.metadata,
        mixins: {
          [MIXIN_KEY]: MIXIN_SCHEMA_URL,
          ...existing.metadata?.mixins,
        },
      },
    };

    const contentLanguage = 'en';
    const putRes = await api.authenticatedFetch(
      `schema/${config.tenant}/custom-entities/${ENTITY_TYPE}/instances/${id}?validateReferences=false`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Language': contentLanguage,
        },
        body: JSON.stringify(updated),
      },
      'service',
      { scopes: ['schema.custominstance_manage'] },
    );

    if (!putRes.ok) {
      const errorBody = await putRes.text();
      logger.error({ id, status: putRes.status, body: errorBody }, 'PUT /api/projects/[id]: update failed');
      return NextResponse.json(
        { error: `Failed to update project: ${putRes.status} ${errorBody}` },
        { status: putRes.status },
      );
    }

    // Re-fetch to return fresh data
    const refreshRes = await api.authenticatedFetch(
      `schema/${config.tenant}/custom-entities/${ENTITY_TYPE}/instances/${id}`,
      { method: 'GET', headers: { Accept: 'application/json', 'Accept-Language': '*' }, cache: 'no-store' },
      'service',
      { scopes: ['schema.custominstance_read'] },
    );

    return NextResponse.json(mapEntity(refreshRes.ok ? await refreshRes.json() : updated));
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'PUT /api/projects/[id]: error');
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const logger = server.get<LoggerService>('LoggerService');
  try {
    const { id } = await params;
    const api = server.get<EmporixApiInvoker>('EmporixApiInvoker');
    const config = server.get('EmporixConfig') as { tenant: string };

    const res = await api.authenticatedFetch(
      `schema/${config.tenant}/custom-entities/${ENTITY_TYPE}/instances/${id}`,
      { method: 'DELETE' },
      'service',
      { scopes: ['schema.custominstance_manage'] },
    );

    if (!res.ok) {
      const errorBody = await res.text();
      logger.error({ id, status: res.status, body: errorBody }, 'DELETE /api/projects/[id]: Emporix error');
      return NextResponse.json(
        { error: `Failed to delete project: ${res.status} ${errorBody}` },
        { status: res.status },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'DELETE /api/projects/[id]: error');
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
