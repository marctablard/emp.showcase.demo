import pino from 'pino';
import {
  getDebugApiOutput,
  getDebugApiResponseMode,
  isDebugApiEnabled,
  isDebugApiResponseEnabled,
} from '@/lib/common/debug-env';
import { getServerLoggerConfig } from '@/platform/core/config/logger-config';
import { type ApiDebugEvent, type DebugCallSource, type DebugCallType, debugEventBus } from './debug-event-bus';

const isDev = process.env.NODE_ENV === 'development';

// ---------------------------------------------------------------------------
// ANSI color codes for terminal output (used only in dev)
// ---------------------------------------------------------------------------
const c = {
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  green: '\x1b[32m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgYellow: '\x1b[43m',
  bold: '\x1b[1m',
} as const;

// ---------------------------------------------------------------------------
// Call-type & source colour themes  (terminal ANSI)
// ---------------------------------------------------------------------------
const CALL_TYPE_COLORS = {
  /** Internal API route call — blue theme */
  internal: { tag: `${c.bgBlue}${c.white}${c.bold}`, prefix: c.blue },
  /** External upstream API call — magenta theme */
  external: { tag: `${c.bgMagenta}${c.white}${c.bold}`, prefix: c.magenta },
} as const;

const SOURCE_COLORS = {
  client: c.cyan,
  ssr: c.yellow,
  unknown: c.dim,
} as const;

// ---------------------------------------------------------------------------
// Configuration helpers  (read env vars once per call — cheap string ops)
// ---------------------------------------------------------------------------
export type DebugOutput = 'terminal' | 'browser' | 'both';
export type DebugCallTypeFilter = 'all' | 'internal' | 'external';
export type DebugSourceFilter = 'all' | 'client' | 'ssr';
export type BrowserDetail = 'payload' | 'headers' | 'body';
export type DebugLevel = 'all' | 'warn' | 'error';

/** Where should debug output be sent? Invalid/missing value disables output. */
function getDebugOutput(): DebugOutput | null {
  return getDebugApiOutput();
}

/** Which call types to log? Default: ALL */
function getDebugCallTypeFilter(): DebugCallTypeFilter {
  const v = (process.env.NEXT_PUBLIC_DEBUG_API_CALL_TYPE || 'all').toLowerCase();
  if (v === 'internal' || v === 'external') return v;
  return 'all';
}

/** Which source to log? Default: ALL */
function getDebugSourceFilter(): DebugSourceFilter {
  const v = (process.env.NEXT_PUBLIC_DEBUG_API_SOURCE || 'all').toLowerCase();
  if (v === 'client' || v === 'ssr') return v;
  return 'all';
}

/** Minimum severity level: ALL (default) | WARN (status >= 400) | ERROR (status >= 500) */
function getDebugLevel(): DebugLevel {
  const v = (process.env.NEXT_PUBLIC_DEBUG_API_LEVEL || 'all').toLowerCase();
  if (v === 'warn' || v === 'error') return v;
  return 'all';
}

/** Should this response status be logged given the current level filter? */
function shouldLogByLevel(status?: number): boolean {
  const level = getDebugLevel();
  if (level === 'all') return true;
  if (!status) return true; // no status yet (pre-response) — let it through
  if (level === 'warn') return status >= 400;
  if (level === 'error') return status >= 500;
  return true;
}

/** Which detail sections to show in the browser Console? Default: all three */
function getBrowserDetails(): Set<BrowserDetail> {
  const raw = (process.env.NEXT_PUBLIC_DEBUG_API_BROWSER_DETAILS || 'payload,headers,body').toLowerCase();
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = new Set<BrowserDetail>();
  for (const p of parts) {
    if (p === 'payload') {
      allowed.add('payload');
      continue;
    }
    if (p === 'headers') {
      allowed.add('headers');
      continue;
    }
    // Accept BODY and BODY-{n} forms so env values like BODY-200 still enable body output.
    if (p === 'body' || /^body-\d+$/.test(p)) {
      allowed.add('body');
    }
  }
  // If nothing valid was specified, default to all
  if (allowed.size === 0) {
    allowed.add('payload');
    allowed.add('headers');
    allowed.add('body');
  }
  return allowed;
}

/** Should this event be logged given current call-type + source filters? */
function shouldLogEvent(callType?: DebugCallType, source?: DebugCallSource): boolean {
  const ctFilter = getDebugCallTypeFilter();
  if (ctFilter !== 'all' && callType && callType !== ctFilter) return false;
  const srcFilter = getDebugSourceFilter();
  if (srcFilter !== 'all' && source && source !== srcFilter) return false;
  return true;
}

/** Should output go to the terminal? */
function shouldLogToTerminal(): boolean {
  const out = getDebugOutput();
  return out === 'terminal' || out === 'both';
}

/** Should output go to the browser (SSE stream)? */
function shouldLogToBrowser(): boolean {
  const out = getDebugOutput();
  return out === 'browser' || out === 'both';
}

/** Is browser debug stream functionally enabled (response logging + browser output)? */
function isBrowserDebugEnabled(): boolean {
  return isDebugApiEnabled() && shouldLogToBrowser();
}

/**
 * Optional context passed through the debug logging pipeline.
 * Callers can provide callType and source to enable richer output.
 */
export interface DebugContext {
  callType?: DebugCallType;
  source?: DebugCallSource;
}

/**
 * Colorizes a pretty-printed JSON string for terminal readability.
 * Keys → cyan, string values → yellow, numbers → magenta, booleans/null → green.
 * Only applied in dev mode (pino-pretty).
 */
function colorizeJson(prettyJson: string): string {
  if (!isDev) return prettyJson;
  return prettyJson
    .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g, `${c.cyan}"$1"${c.reset}:`) // keys
    .replace(/:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g, `: ${c.yellow}"$1"${c.reset}`) // string values
    .replace(/:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, `: ${c.magenta}$1${c.reset}`) // numbers
    .replace(/:\s*(true|false|null)\b/g, `: ${c.green}$1${c.reset}`); // booleans/null
}

// Lazy-initialised pino child logger for API debug logging
let _debugLogger: pino.Logger | null = null;

// Track request start times for duration calculation (dev only)
const _requestTimestamps = new Map<string, number>();

// Track debug contexts per request so logResponse can access them (dev only)
const _requestContexts = new Map<string, DebugContext>();

/** Generate a short unique ID for correlating request/response events */
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Format an ANSI-coloured call-type tag for terminal output, e.g. ` EXTERNAL ` */
function formatCallTypeTag(callType?: DebugCallType): string {
  if (!isDev || !callType) return '';
  const theme = CALL_TYPE_COLORS[callType];
  const label = callType.toUpperCase();
  return `${theme.tag} ${label} ${c.reset} `;
}

/** Format a coloured source badge for terminal output */
function formatSourceBadge(source?: DebugCallSource): string {
  if (!isDev || !source || source === 'unknown') return '';
  const colour = SOURCE_COLORS[source];
  return `${colour}[${source.toUpperCase()}]${c.reset} `;
}

/**
 * Returns a lazy-initialised pino child logger for API debug/request logging.
 * Exported for use by EmporixApiInvoker and EmporixOAuthApi.
 */
export function getDebugLogger(): pino.Logger {
  if (!_debugLogger) {
    _debugLogger = pino(getServerLoggerConfig()).child({ module: 'api-debug' });
  }
  return _debugLogger;
}

// Central definition for all sensitive keys (used for headers and query params)
const SENSITIVE_KEYS_NORMALIZED = new Set(['session', 'secret', 'password', 'token', 'auth', 'api', 'client']);

/**
 * Normalizes a key by removing separators and converting to lower case.
 * e.g., 'api-key' -> 'apikey', 'Session_Id' -> 'sessionid'
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, '');
}

/**
 * Checks if a key is considered sensitive (after normalization)
 */
function isSensitiveKey(key: string): boolean {
  const normalizedKey = normalizeKey(key);
  return Array.from(SENSITIVE_KEYS_NORMALIZED).some((root) => normalizedKey.includes(root));
}

/**
 * Decides if sensitive data should be masked (prod or not verbose)
 */
function shouldMaskSensitive(): boolean {
  const debugCurlVerbose = process.env.NEXT_PUBLIC_DEBUG_API_VERBOSE === 'true';
  const isProd = process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  return isProd || !debugCurlVerbose;
}

/**
 * Masks sensitive headers (e.g. token, password, client_secret, etc.)
 * @param headers The headers object to mask
 * @returns A new headers object with sensitive values replaced by ******
 */
function maskHeaders(headers: Record<string, any>): Record<string, any> {
  const masked: Record<string, any> = {};
  for (const [key, value] of Object.entries(headers)) {
    masked[key] = isSensitiveKey(key) ? '******' : value;
  }
  return masked;
}

/**
 * Masks sensitive query parameters in a URL (e.g. token, password, client_secret, etc.)
 * @param url The URL string to mask
 * @returns The URL with sensitive query parameter values replaced by ******
 */
function maskSensitiveQueryParams(url: string): string {
  try {
    const u = new URL(url, 'http://dummy'); // base needed for relative URLs
    for (const key of u.searchParams.keys()) {
      if (isSensitiveKey(key)) {
        u.searchParams.set(key, '******');
      }
    }
    return u.pathname + (u.search ? u.search : '');
  } catch {
    // Fallback: if URL can't be parsed, return placeholder
    return '<URL not parsable>';
  }
}

/**
 * Generates a descriptive prefix for logging, combining the URL's path
 * with a deterministic hash of the full URL.
 * @param url The URL string
 * @returns A string (e.g., 'PROD-02de') for use as a log prefix
 */
function getDebugPrefix(url: string): string {
  // 1. Calculate the hash (your original, reliable logic)
  let sum = 0;
  for (let i = 0; i < url.length; i++) sum += url.charCodeAt(i);
  const hash = sum.toString(36).padStart(4, '0').slice(-4);

  // 2. Try to get the path prefix
  let pathPrefix = 'URL_'; // Default fallback if parsing fails
  try {
    const u = new URL(url, '/dummy');
    const path = u.pathname.replace(/^\//, ''); // Remove leading '/'

    if (path.length === 0) {
      pathPrefix = 'ROOT'; // Special case for root path '/'
    } else {
      pathPrefix = path.substring(0, 4).toUpperCase();
    }
  } catch {
    // Parsing failed, keep 'URL_' as the prefix
  }

  // 3. Combine them and ensure uniform length
  // e.g., 'API' becomes 'API0'
  const finalPrefix = pathPrefix.padEnd(4, '0');

  return `${finalPrefix}-${hash}`;
}

/**
 * Builds a curl command for debugging purposes (not exported)
 * @param url The request URL
 * @param options The fetch options
 * @param maskSensitive Whether to mask sensitive data in headers and query params
 * @returns The curl command as a string
 */
function buildCurl(url: string, options: RequestInit, maskSensitive: boolean = true): string {
  const maskedUrl = maskSensitive ? maskSensitiveQueryParams(url) : url;
  const headers = options.headers || {};
  const usedHeaders = maskSensitive ? maskHeaders(headers) : headers;
  const headerString = Object.entries(usedHeaders)
    .map(([key, value]) => `-H '${key}: ${value}'`)
    .join(' ');
  const methodString = options.method ? `-X ${options.method}` : '';
  const bodyString = options.body ? `-d '${options.body}'` : '';
  return `curl -v ${methodString} ${headerString} ${bodyString} '${maskedUrl}'`;
}

/**
 * Checks if the current URL matches any of the debug endpoints configured in NEXT_PUBLIC_DEBUG_API_ENDPOINTS
 * If the env var is not set, all endpoints are logged.
 * @param url The request URL
 * @returns true if the URL should be logged
 */
function shouldLogEndpoint(url: string): boolean {
  const endpoints = (process.env.NEXT_PUBLIC_DEBUG_API_ENDPOINTS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (endpoints.length === 0) return true; // No filter set, log everything
  try {
    const u = new URL(url, 'http://dummy');
    const path = u.pathname.toLowerCase();
    return endpoints.some((endpoint) => path.includes(endpoint));
  } catch {
    // If URL can't be parsed, fallback: log everything
    return true;
  }
}

/**
 * Logs a curl command if debugging is enabled (reads environment variables directly).
 * In dev mode also records a start timestamp for duration calculation.
 * @param url Target URL
 * @param options Request options
 * @param ctx Optional debug context (call type, source)
 * @returns The log prefix used for this request
 */
export function buildAndLogCurl(url: string, options: RequestInit, ctx?: DebugContext): string {
  const debugCurl = process.env.NEXT_PUBLIC_DEBUG_API_CURL === 'true';
  const maskSensitive = shouldMaskSensitive();
  let logPrefix = '';
  if (debugCurl) {
    if (!shouldLogEndpoint(url)) return '';
    if (!shouldLogEvent(ctx?.callType, ctx?.source)) return '';
    logPrefix = `[${getDebugPrefix(url)}]`;
    if (shouldLogToTerminal()) {
      const typeTag = formatCallTypeTag(ctx?.callType);
      getDebugLogger().debug(`${typeTag}${logPrefix} ${buildCurl(url, options, maskSensitive)}`);
    }
  }
  // Track request start time for the SSE debug stream whenever browser debug is enabled.
  if (isBrowserDebugEnabled()) {
    const requestId = generateRequestId();
    _requestTimestamps.set(`${(options.method || 'GET').toUpperCase()}:${url}`, Date.now());
    // Store the requestId so logResponse can correlate
    _requestTimestamps.set(`rid:${(options.method || 'GET').toUpperCase()}:${url}`, requestId as unknown as number);
    // Store the debug context so logResponse can use it
    if (ctx) {
      _requestContexts.set(`ctx:${(options.method || 'GET').toUpperCase()}:${url}`, ctx);
    }
  }
  return logPrefix;
}

/**
 * Logs a fetch Response according to NEXT_PUBLIC_DEBUG_RESPONSE config.
 * @param response The fetch Response object
 * @param url The request URL
 * @param requestOptions The original request options
 * @param prefix Optional log prefix
 * @param ctx Optional debug context (call type, source). Falls back to stored context from buildAndLogCurl.
 */
export async function logResponse(
  response: Response,
  url: string,
  requestOptions: RequestInit,
  prefix?: string,
  ctx?: DebugContext,
): Promise<void> {
  const maskSensitive = shouldMaskSensitive();
  const debugResponse = getDebugApiResponseMode();
  if (!debugResponse) return;
  if (!shouldLogEndpoint(url)) return;

  const method = (requestOptions.method || 'GET').toUpperCase();

  // Recover stored context if not explicitly passed
  const ctxKey = `ctx:${method}:${url}`;
  const effectiveCtx: DebugContext = ctx || _requestContexts.get(ctxKey) || {};
  _requestContexts.delete(ctxKey);

  if (!shouldLogEvent(effectiveCtx.callType, effectiveCtx.source)) return;

  const status = response.status;
  if (!shouldLogByLevel(status)) return;
  const isError = status >= 400;
  const logger = getDebugLogger();
  const log = isError ? logger.error.bind(logger) : logger.debug.bind(logger);
  const maskedUrl = maskSensitive ? maskSensitiveQueryParams(url) : url;

  const typeTag = formatCallTypeTag(effectiveCtx.callType);
  const srcBadge = formatSourceBadge(effectiveCtx.source);
  const logPrefix = prefix
    ? `${typeTag}${srcBadge}${prefix} [${method} ${status}]`
    : `${typeTag}${srcBadge}[${method} ${status}]`;

  // Build a human-readable, pretty-printed log message
  let message = `${logPrefix} ${maskedUrl}`;

  // --- 1. Handle Headers ---
  const needsHeaders = debugResponse === 'status-headers' || debugResponse === 'full';
  let responseHeaders: Record<string, string> | undefined;
  if (needsHeaders && shouldLogToTerminal()) {
    let headers = Object.fromEntries(response.headers.entries());
    if (maskSensitive) {
      headers = maskHeaders(headers);
    }
    responseHeaders = headers;
    const prettyHeaders = JSON.stringify(headers, null, 2).replace(/\n/g, '\n    ');
    message += `\n  ${c.dim}Headers:${c.reset} ${colorizeJson(prettyHeaders)}`;
  }

  // --- 2. Handle Body (read once — the caller will consume the original, making re-clone impossible) ---
  const needsBody = debugResponse.startsWith('status-body') || debugResponse === 'full';
  let bodyText: string | undefined;
  if (needsBody) {
    try {
      bodyText = await response.clone().text();

      if (shouldLogToTerminal()) {
        if (debugResponse.startsWith('status-body-')) {
          const limit = parseInt(debugResponse.split('-')[2], 10) || 200;
          message += `\n  Body (max ${limit} chars): ${bodyText.slice(0, limit)}`;
        } else {
          // Pretty-print JSON bodies; fall back to raw text for non-JSON
          try {
            const parsed = JSON.parse(bodyText);
            const prettyBody = JSON.stringify(parsed, null, 2).replace(/\n/g, '\n    ');
            message += `\n  ${c.dim}Body:${c.reset} ${colorizeJson(prettyBody)}`;
          } catch {
            message += `\n  ${c.dim}Body:${c.reset} ${bodyText}`;
          }
        }
      }
    } catch (err) {
      if (shouldLogToTerminal()) {
        message += `\n  Body error: ${err}`;
      }
    }
  }

  // --- 3. Final Log (terminal) ---
  if (shouldLogToTerminal()) {
    log(message);
  }

  // --- 4. Extract request payload string for the browser event ---
  let requestBodyStr: string | undefined;
  if (requestOptions.body) {
    try {
      const body = requestOptions.body;
      requestBodyStr =
        typeof body === 'string' ? body : body instanceof URLSearchParams ? body.toString() : JSON.stringify(body);
      if (maskSensitive && requestBodyStr && requestBodyStr.length > 500) {
        requestBodyStr = requestBodyStr.substring(0, 500) + '...(truncated)';
      }
    } catch {
      // ignore
    }
  }

  // --- 5. Emit to browser debug stream whenever enabled by env flags ---
  if (isBrowserDebugEnabled()) {
    const tsKey = `${method}:${url}`;
    const ridKey = `rid:${tsKey}`;
    const startTime = _requestTimestamps.get(tsKey);
    const requestId = _requestTimestamps.get(ridKey);
    _requestTimestamps.delete(tsKey);
    _requestTimestamps.delete(ridKey);

    // Compute headers for SSE independently from terminal mode.
    if (!responseHeaders) {
      let hdrs = Object.fromEntries(response.headers.entries());
      if (maskSensitive) hdrs = maskHeaders(hdrs);
      responseHeaders = hdrs;
    }
    // Always include full raw response body in browser events so DevTools can show unmapped fields.
    if (!bodyText) {
      try {
        bodyText = await response.clone().text();
      } catch {
        // already consumed
      }
    }

    const event: ApiDebugEvent = {
      id: requestId ? String(requestId) : generateRequestId(),
      timestamp: new Date().toISOString(),
      method,
      url: maskedUrl,
      status,
      responseHeaders,
      responseBody: bodyText,
      requestBody: requestBodyStr,
      duration: startTime ? Date.now() - startTime : undefined,
      prefix: prefix || undefined,
      isError,
      callType: effectiveCtx.callType,
      source: effectiveCtx.source,
    };
    debugEventBus.emit(event);
  } else {
    // Clean up timestamps even if we skip browser emit
    const tsKey = `${method}:${url}`;
    _requestTimestamps.delete(tsKey);
    _requestTimestamps.delete(`rid:${tsKey}`);
  }
}

/**
 * Logs the request payload when NEXT_DEBUG_API_PAYLOAD is enabled.
 * Only logs for methods that typically have a body (POST, PUT, PATCH).
 * @param url Target URL
 * @param options Request options
 * @param prefix Optional log prefix
 * @param ctx Optional debug context (call type, source)
 */
export function logRequestPayload(url: string, options: RequestInit, prefix: string, ctx?: DebugContext): void {
  const debugPayload = process.env.NEXT_DEBUG_API_PAYLOAD === 'true';
  if (!debugPayload) return;
  if (!shouldLogEndpoint(url)) return;
  if (!shouldLogEvent(ctx?.callType, ctx?.source)) return;
  if (!shouldLogToTerminal()) return;

  const method = (options.method || 'GET').toUpperCase();
  if (!['POST', 'PUT', 'PATCH'].includes(method)) return;

  const body = options.body;
  if (!body) return;

  const logger = getDebugLogger();
  const typeTag = formatCallTypeTag(ctx?.callType);
  const logPrefix = prefix || `[${getDebugPrefix(url)}]`;

  try {
    const bodyStr =
      typeof body === 'string' ? body : body instanceof URLSearchParams ? body.toString() : JSON.stringify(body);
    const maskSensitive = shouldMaskSensitive();
    if (maskSensitive) {
      logger.debug(
        `${typeTag}${logPrefix} [${method} PAYLOAD] ${bodyStr.substring(0, 500)}${bodyStr.length > 500 ? '...(truncated)' : ''}`,
      );
    } else {
      logger.debug(`${typeTag}${logPrefix} [${method} PAYLOAD] ${bodyStr}`);
    }
  } catch {
    logger.debug(`${typeTag}${logPrefix} [${method} PAYLOAD] <unserializable body>`);
  }
}

/**
 * Attaches X-Debug-Upstream-* headers to a NextResponse so that upstream
 * API call metadata is visible in the browser Network tab.
 *
 * Call this in API route handlers after the upstream call completes.
 * No-op in production or when debug response logging is off.
 *
 * @param nextResponse The NextResponse to mutate
 * @param upstreamResponse The upstream fetch Response
 * @param url The upstream URL
 * @param startTime Optional `Date.now()` captured before the fetch
 */
export function attachDebugHeaders(
  nextResponse: { headers: Headers },
  upstreamResponse: Response,
  url: string,
  startTime?: number,
): void {
  if (!isDebugApiResponseEnabled()) return;

  const maskSensitive = shouldMaskSensitive();
  const maskedUrl = maskSensitive ? maskSensitiveQueryParams(url) : url;

  nextResponse.headers.set('X-Debug-Upstream-Url', maskedUrl);
  nextResponse.headers.set('X-Debug-Upstream-Status', String(upstreamResponse.status));
  if (startTime) {
    nextResponse.headers.set('X-Debug-Upstream-Duration', `${Date.now() - startTime}ms`);
  }
}

// ---------------------------------------------------------------------------
// API Route Debug Wrapper  — instruments internal Next.js API calls
// ---------------------------------------------------------------------------

/**
 * Wraps a Next.js API route handler to automatically log the internal
 * request / response as an `internal` debug event. The handler itself is
 * unchanged — this only adds debug logging around it.
 *
 * Usage:
 * ```ts
 * import { withApiRouteDebug } from '@/platform/core/utils/debug-utils';
 *
 * async function handler(request: NextRequest) { ... }
 *
 * export const GET  = withApiRouteDebug(handler);
 * export const POST = withApiRouteDebug(handler);
 * ```
 */
export function withApiRouteDebug<T extends (...args: any[]) => Promise<Response>>(handler: T): T {
  const wrapped = async (...args: any[]): Promise<Response> => {
    if (!isDebugApiResponseEnabled()) return handler(...args);

    const request = args[0] as Request | undefined;
    if (!request || typeof request.url !== 'string') return handler(...args);

    const ctx: DebugContext = { callType: 'internal', source: 'client' };
    const method = request.method?.toUpperCase() || 'GET';
    const url = request.url;

    if (!shouldLogEndpoint(url)) return handler(...args);
    if (!shouldLogEvent(ctx.callType, ctx.source)) return handler(...args);

    const start = Date.now();
    const requestId = generateRequestId();

    // Extract request body for POST/PUT/PATCH
    let reqBodyStr: string | undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        reqBodyStr = await request.clone().text();
      } catch {
        // body might not be readable
      }
    }

    let response: Response;
    try {
      response = await handler(...args);
    } catch (err) {
      // Log the error and re-throw
      const logger = getDebugLogger();
      const typeTag = formatCallTypeTag('internal');
      logger.error(`${typeTag}[${method} ERROR] ${url} — ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }

    const duration = Date.now() - start;
    const status = response.status;
    if (!shouldLogByLevel(status)) return response;
    const isError = status >= 400;
    const maskSensitive = shouldMaskSensitive();

    // Terminal log
    if (shouldLogToTerminal()) {
      const typeTag = formatCallTypeTag('internal');
      const maskedUrl = maskSensitive ? maskSensitiveQueryParams(url) : url;
      const logger = getDebugLogger();
      const log = isError ? logger.error.bind(logger) : logger.debug.bind(logger);
      log(`${typeTag}[${method} ${status}] ${maskedUrl} (${duration}ms)`);

      // Log request payload to terminal
      if (reqBodyStr && process.env.NEXT_DEBUG_API_PAYLOAD === 'true') {
        const payloadPreview = maskSensitive ? reqBodyStr.substring(0, 500) : reqBodyStr;
        logger.debug(
          `${typeTag}[${method} PAYLOAD] ${payloadPreview}${reqBodyStr.length > 500 ? '...(truncated)' : ''}`,
        );
      }
    }

    // Browser SSE event
    if (shouldLogToBrowser()) {
      const maskedUrl = maskSensitive ? maskSensitiveQueryParams(url) : url;
      let resBodyText: string | undefined;
      let resHeaders: Record<string, string> | undefined;

      try {
        resBodyText = await response.clone().text();
      } catch {
        // body already consumed
      }
      try {
        let hdrs = Object.fromEntries(response.headers.entries());
        if (maskSensitive) hdrs = maskHeaders(hdrs);
        resHeaders = hdrs;
      } catch {
        // ignore
      }

      const event: ApiDebugEvent = {
        id: requestId,
        timestamp: new Date().toISOString(),
        method,
        url: maskedUrl,
        status,
        responseHeaders: resHeaders,
        responseBody: resBodyText,
        requestBody: reqBodyStr,
        duration,
        isError,
        callType: 'internal',
        source: 'client',
      };
      debugEventBus.emit(event);
    }

    return response;
  };

  return wrapped as T;
}

/** Re-export getBrowserDetails for the ApiDebugPanel */
export { getBrowserDetails };
