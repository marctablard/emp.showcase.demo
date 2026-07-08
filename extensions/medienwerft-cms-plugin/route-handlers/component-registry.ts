import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { buildComponentRegistryResponse } from '../lib/serialize-component-registry';
import type { CMSComponentService } from '../services/CMSComponentService';

/**
 * GET handler for the storefront's component registry.
 *
 * Designed to be re-exported from `app/api/cms/component-registry/route.ts`
 * together with the preflight handler:
 *
 * ```ts
 * export {
 *   componentRegistryGET as GET,
 *   componentRegistryOPTIONS as OPTIONS,
 * } from '@extensions/medienwerft-cms-plugin/route-handlers';
 * ```
 *
 * Publishes the storefront's CMS component catalogue in the wire format
 * the Emporix CMS MCP server expects (`list_component_types` tool).
 * Agents author CMS content against this catalogue, so the response is
 * the **storefront's** view of what types exist and what props they
 * accept — pulled from the same DI-bound `EmporixCMSComponentService`
 * the live editor uses, ensuring the editor UI and the agent agree on
 * the schema without a parallel source of truth.
 *
 * Wire-format details (validated server-side by
 * `mcp-server/src/tools/schemas.ts` in `emporix-jas-cms-plugin`):
 *
 *  - Body: `{ "$schema": "https://emporix.io/cms/component-registry/v1",
 *    "components": { "<type>": { ... } } }`.
 *  - Each component is translated by
 *    {@link serializeComponentDefinition} so `$ref` references are
 *    expanded, `allowedComponentTypes` collapses onto the wire format's
 *    single `allowedTypes` key, and plugin-only fields
 *    (`dynamicOptionsSource`) are stripped.
 *
 * Auth contract:
 *
 *  - When `NEXT_PUBLIC_CMS_EDITOR_API_KEY` is set, the request must
 *    carry a matching `X-Emporix-API-Key` header; mismatches return
 *    401. The comparison runs in constant time via `timingSafeEqual`.
 *  - When the env var is unset (typical development), the route accepts
 *    any caller — same dev-friendly posture as the live-editor iframe
 *    handshake.
 *
 * CORS:
 *
 *  - The CMS plugin calls this endpoint directly from the browser
 *    (Copy-to-Locale, site-clone). Missing CORS surfaces in the browser
 *    as "Failed to fetch" — not 4xx — because the response is rejected
 *    before JS ever sees it. The MCP server-side path is unaffected
 *    because it doesn't run in a browser.
 *  - Allowed origins come from `CMS_EDITOR_ORIGINS` (comma-separated,
 *    defaults to `https://app.emporix.io`), matching the convention
 *    used by the rest of the editor surface in `next.config.ts`.
 *  - `componentRegistryOPTIONS` answers the preflight; every GET
 *    response (including 401/500) carries the same CORS headers so the
 *    browser surfaces real status codes instead of "Failed to fetch".
 *
 * Caching:
 *
 *  - Responds with `Cache-Control: public, max-age=300`. The MCP server
 *    additionally caches in-process for 5 minutes per `(site, url)`,
 *    so editor changes to the component registry surface within ~5
 *    minutes without a deploy. `Vary: Origin` is set so shared caches
 *    don't serve a response with the wrong CORS headers to a different
 *    origin.
 *
 * Query params:
 *
 *  - `theme` (optional): when the storefront's component service scopes
 *    entries per theme (`themes: ['<name>']` on `CMSComponentEntry`),
 *    pass `?theme=<name>` to filter the response. Omitting the param
 *    returns every registered entry — preferred for the MCP path so
 *    agents see the full catalogue.
 */
export async function componentRegistryGET(request: NextRequest): Promise<NextResponse> {
  const logger = server.get<LoggerService>('LoggerService');
  const corsHeaders = buildCorsHeaders(request);

  try {
    if (!authorize(request)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const componentService = server.get<CMSComponentService>('EmporixCMSComponentService');

    const theme = request.nextUrl.searchParams.get('theme') ?? undefined;
    const entries = componentService.getDefinitions(theme);
    const body = buildComponentRegistryResponse(entries);

    return NextResponse.json(body, {
      headers: {
        ...corsHeaders,
        // Server-side recommended cache; the MCP server also caches
        // in-memory per (site, url) for the same window.
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/cms/component-registry',
        method: 'GET',
      },
      'Error building CMS component registry',
    );
    return NextResponse.json({ error: 'Failed to build component registry' }, { status: 500, headers: corsHeaders });
  }
}

/**
 * OPTIONS preflight handler. Answers the browser's preflight probe
 * with the same CORS headers as the GET response. See `componentRegistryGET`
 * for the CORS contract.
 */
export function componentRegistryOPTIONS(request: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: buildCorsHeaders(request) });
}

/**
 * Returns true if the request is allowed.
 *
 *  - When `NEXT_PUBLIC_CMS_EDITOR_API_KEY` is unset, every caller is
 *    allowed (development posture; the live-editor handshake follows
 *    the same rule).
 *  - When set, the `X-Emporix-API-Key` header must equal it; the
 *    comparison runs in constant time so a timing oracle can't recover
 *    the key byte-by-byte.
 */
function authorize(request: NextRequest): boolean {
  const expected = process.env.NEXT_PUBLIC_CMS_EDITOR_API_KEY;
  if (!expected) return true;

  const supplied = request.headers.get('x-emporix-api-key');
  if (!supplied) return false;

  const expectedBuf = Buffer.from(expected, 'utf8');
  const suppliedBuf = Buffer.from(supplied, 'utf8');
  if (expectedBuf.length !== suppliedBuf.length) return false;
  return timingSafeEqual(expectedBuf, suppliedBuf);
}

/**
 * Build CORS response headers for a request.
 *
 * Allowed origins come from `CMS_EDITOR_ORIGINS` (comma-separated,
 * defaults to `https://app.emporix.io`). The request's `Origin` is
 * echoed back when it is in the allowlist; otherwise the first
 * configured origin is returned so the browser correctly rejects the
 * response on the request side rather than silently succeeding.
 *
 * `Vary: Origin` is set so shared caches do not serve a response with
 * the wrong CORS headers to a different origin.
 */
function buildCorsHeaders(request: NextRequest): Record<string, string> {
  const allowed = (process.env.CMS_EDITOR_ORIGINS ?? 'https://app.emporix.io')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const requestOrigin = request.headers.get('origin');
  const allowOrigin = requestOrigin && allowed.includes(requestOrigin) ? requestOrigin : allowed[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin ?? '',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Emporix-API-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
