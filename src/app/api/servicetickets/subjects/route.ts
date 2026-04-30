import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import server from '@/platform/server';

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const api = server.get<EmporixApiInvoker>('EmporixApiInvoker');
    const config = server.get('EmporixConfig') as { tenant: string };

    const res = await api.authenticatedFetch(
      `schema/${config.tenant}/custom-entities/SERVICESUBJECTS/instances`,
      {
        method: 'GET',
        headers: { Accept: 'application/json', 'Accept-Language': '*' },
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
      ? instances.map((it) => ({
          id: it?.id,
          name: it?.name || {},
        }))
      : [];

    return NextResponse.json(data);
  } catch (e) {
    console.error('Failed to fetch service ticket subjects:', e);
    return NextResponse.json({ error: 'Failed to fetch service ticket subjects' }, { status: 500 });
  }
}
