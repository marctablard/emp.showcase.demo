import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import 'server-only';
import server from '@/platform/server';
import { getCmsService } from '@/platform/services/cms/get-cms-service';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * POST /api/cms/webhook
 *
 * Provider-agnostic CMS webhook sink. The active `CMSService` (chosen at
 * bootstrap by `CmsProviderResolver`) owns signature verification and payload
 * mapping; this handler only dispatches and translates the result to HTTP.
 *
 * Contract:
 * - Adapter without a webhook surface → `405 Method Not Allowed`.
 * - `NEXT_CMS_WEBHOOK_SECRET` absent → `503 Service Unavailable` (webhook
 *   deliberately disabled; HMAC cannot be verified without a secret).
 * - Otherwise `cms.handleWebhook(req)` runs and its `{ status, body }` is
 *   passed through verbatim (valid HMAC → 200 + invalidation, invalid → 401).
 *
 * CSRF: `src/proxy.ts` exempts exactly `/api/cms/webhook` from CSRF — the HMAC
 * signature replaces the CSRF token for this machine-to-machine endpoint.
 *
 * Provider isolation: this file dispatches solely through DI
 * (`getCmsService()`); it never imports `@storyblok/*` or the Storyblok
 * integration. A drift test pins that boundary.
 */
export async function POST(request: NextRequest) {
  const logger = server.get<LoggerService>('LoggerService');

  try {
    const cms = await getCmsService();

    // Capability gate first: a provider without a webhook surface has no
    // endpoint here regardless of secret configuration.
    if (typeof cms.handleWebhook !== 'function') {
      return NextResponse.json({ error: 'CMS webhook not supported' }, { status: 405 });
    }

    // Webhook deliberately disabled when no signing secret is configured.
    if (!process.env.NEXT_CMS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'CMS webhook disabled' }, { status: 503 });
    }

    const result = await cms.handleWebhook(request);
    logger.info(
      { path: '/api/cms/webhook', method: 'POST', provider: cms.providerId, status: result.status },
      'CMS webhook handled',
    );
    return NextResponse.json(result.body ?? null, { status: result.status });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/cms/webhook',
        method: 'POST',
      },
      'Error handling CMS webhook',
    );
    return NextResponse.json({ error: 'Failed to handle CMS webhook' }, { status: 500 });
  }
}
