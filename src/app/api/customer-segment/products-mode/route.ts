import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PRODUCTS_MODE_COOKIE_NAME, formatProductsModeOptIn } from '@/lib/common/products-mode-cookie';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ProductsModeService } from '@/platform/services/products-mode/ProductsModeService';

/** Only these two values can be requested by the client; `anonymous`/`unsegmented` are derived server-side. */
type RequestedProductsMode = 'all' | 'assigned';

const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

function isRequestedProductsMode(value: unknown): value is RequestedProductsMode {
  return value === 'all' || value === 'assigned';
}

async function parseRequestedMode(request: NextRequest): Promise<RequestedProductsMode | undefined> {
  try {
    const body: unknown = await request.json();
    const mode = typeof body === 'object' && body !== null ? (body as { mode?: unknown }).mode : undefined;
    return isRequestedProductsMode(mode) ? mode : undefined;
  } catch {
    return undefined;
  }
}

function privateJson(body: unknown, status: number = 200): NextResponse {
  return NextResponse.json(body, { status, headers: PRIVATE_NO_STORE });
}

function deleteProductsModeCookie(response: NextResponse): void {
  response.cookies.delete({ name: PRODUCTS_MODE_COOKIE_NAME, path: '/' });
}

/**
 * PUT /api/customer-segment/products-mode (COP-4822).
 *
 * The only writer of the `next-products-mode` opt-in cookie. The requested mode is validated
 * against the server-resolved `ProductsModeContext` — the client cannot switch to `all` unless
 * `canToggleAllProducts` holds (`NEXT_PUBLIC_ALLOW_SEGMENTS_OVERRIDE=true`, segmented customer — any
 * search engine). The cookie
 * value is bound to the customer id so a stale cookie from another user is ignored. Every response
 * is personalised and therefore `Cache-Control: private, no-store`. CSRF is enforced by the proxy.
 */
export async function PUT(request: NextRequest) {
  const requestedMode = await parseRequestedMode(request);
  if (requestedMode === undefined) {
    return privateJson({ error: 'Invalid body: expected { mode: "all" | "assigned" }' }, 400);
  }

  try {
    const url = new URL(request.url);
    const productsModeService = server.get<ProductsModeService>('ProductsModeService');
    const ctx = await productsModeService.resolve({
      optInCookieValue: request.cookies.get(PRODUCTS_MODE_COOKIE_NAME)?.value,
      siteCode: url.searchParams.get('site') ?? undefined,
    });

    if (!ctx.canToggleAllProducts || ctx.customerId === undefined) {
      const forbidden = privateJson({ error: 'ALL_PRODUCTS_MODE_NOT_ALLOWED' }, 403);
      deleteProductsModeCookie(forbidden);
      return forbidden;
    }

    const response = privateJson({ mode: requestedMode });
    if (requestedMode === 'all') {
      response.cookies.set({
        name: PRODUCTS_MODE_COOKIE_NAME,
        value: formatProductsModeOptIn(ctx.customerId),
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        // No maxAge: session cookie — the opt-in ends with the browser session.
      });
    } else {
      deleteProductsModeCookie(response);
    }
    return response;
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/customer-segment/products-mode',
        method: 'PUT',
        requestedMode,
      },
      'Error updating products mode',
    );
    return privateJson({ error: 'Failed to update products mode' }, 500);
  }
}
