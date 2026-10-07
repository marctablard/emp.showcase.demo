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

    // Capture the webhook handler once: `handleWebhook` is a getter that
    // allocates a fresh closure per access, so reading it twice (capability
    // check + invocation) would build two closures and risk drift if the
    // getter ever became non-idempotent.
    const handleWebhook = cms.handleWebhook;

    // Capability gate: a provider without a webhook surface answers 405.
    // Secret-gate (503) and HMAC validation (401) are owned by the service /
    // adapter, not the route — so only HMAC-based adapters need a secret.
    if (typeof handleWebhook !== 'function') {
      return NextResponse.json({ error: 'CMS webhook not supported' }, { status: 405 });
    }

    const result = await handleWebhook(request);
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
