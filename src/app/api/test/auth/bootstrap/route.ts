import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type {
  LocalAuthSyncBootstrapResult,
  LocalAuthSyncBootstrapServiceContract,
} from '@/platform/services/auth/LocalAuthSyncBootstrapService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

const LOCAL_AUTH_BOOTSTRAP_ENABLED_ENV = 'NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_ENABLED';
const LOCAL_AUTH_BOOTSTRAP_HEADER = 'x-emporix-local-auth-bootstrap';
const LOCAL_AUTH_BOOTSTRAP_HEADER_VALUE = 'auth-site-sync';
const LOCAL_AUTH_BOOTSTRAP_TOKEN_ENV = 'NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_TOKEN';
const LOCAL_AUTH_BOOTSTRAP_TOKEN_HEADER = 'x-emporix-local-auth-bootstrap-token';
const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1', '::1']);

function isBootstrapEnabled(): boolean {
  return process.env[LOCAL_AUTH_BOOTSTRAP_ENABLED_ENV] === 'true';
}

function getBootstrapToken(): string | null {
  const value = process.env[LOCAL_AUTH_BOOTSTRAP_TOKEN_ENV]?.trim();
  return value ? value : null;
}

function isAllowedBootstrapRequest(request: NextRequest): boolean {
  const headerValue = request.headers.get(LOCAL_AUTH_BOOTSTRAP_HEADER);
  const token = getBootstrapToken();
  const tokenHeaderValue = request.headers.get(LOCAL_AUTH_BOOTSTRAP_TOKEN_HEADER);

  return (
    headerValue === LOCAL_AUTH_BOOTSTRAP_HEADER_VALUE &&
    token !== null &&
    tokenHeaderValue === token &&
    LOCALHOST_NAMES.has(request.nextUrl.hostname)
  );
}

/**
 * POST /api/test/auth/bootstrap
 *
 * Local Playwright seam for the auth/site-sync scenario. This route only bootstraps the
 * shopper session observed through `/api/session`; it intentionally does not mint
 * NextAuth/Auth.js browser state because the scenario never enters account-protected pages.
 * The route stays local-only through the explicit env flag plus localhost/header request
 * guards, which lets the dedicated Playwright lane run under `next start` on a separate
 * localhost port without exposing the bootstrap surface to production traffic.
 * The browser context itself provides cleanup isolation between runs, and this handler
 * resets the current request-scoped shopper session before bootstrapping.
 */
export async function POST(request: NextRequest) {
  const logger = server.get<LoggerService>('LoggerService');

  if (!isBootstrapEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!isAllowedBootstrapRequest(request)) {
    logger.warn(
      {
        hostname: request.nextUrl.hostname,
        hasExpectedHeader: request.headers.get(LOCAL_AUTH_BOOTSTRAP_HEADER) === LOCAL_AUTH_BOOTSTRAP_HEADER_VALUE,
        hasExpectedTokenHeader:
          request.headers.get(LOCAL_AUTH_BOOTSTRAP_TOKEN_HEADER) === (getBootstrapToken() ?? '__missing__'),
        path: '/api/test/auth/bootstrap',
      },
      'Rejected local auth bootstrap request',
    );
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const bootstrapService = server.get<LocalAuthSyncBootstrapServiceContract>('LocalAuthSyncBootstrapService');
    const result = await bootstrapService.bootstrap();
    return NextResponse.json(sanitizeBootstrapResult(result));
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/test/auth/bootstrap',
      },
      'Failed to bootstrap local auth-sync session',
    );
    return NextResponse.json({ error: 'Failed to bootstrap local auth session' }, { status: 500 });
  }
}

function sanitizeBootstrapResult(result: LocalAuthSyncBootstrapResult) {
  return {
    authenticated: result.authenticated,
    siteCode: result.siteCode,
    currency: result.currency,
  };
}
