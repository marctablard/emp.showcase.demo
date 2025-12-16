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
 * Logs a curl command if debugging is enabled (reads environment variables directly)
 * @param url Target URL
 * @param options Request options
 * @returns The log prefix used for this request
 */
export function buildAndLogCurl(url: string, options: RequestInit): string {
  const debugCurl = process.env.NEXT_PUBLIC_DEBUG_API_CURL === 'true';
  const maskSensitive = shouldMaskSensitive();
  let logPrefix = '';
  if (debugCurl) {
    if (!shouldLogEndpoint(url)) return '';
    logPrefix = `[${getDebugPrefix(url)}]`;
    console.debug(`${logPrefix} ${buildCurl(url, options, maskSensitive)}`);
  }
  return logPrefix;
}

/**
 * Logs a fetch Response according to NEXT_PUBLIC_DEBUG_RESPONSE config.
 * @param response The fetch Response object
 * @param url The request URL
 * @param requestOptions The original request options
 * @param prefix Optional log prefix
 */
export async function logResponse(
  response: Response,
  url: string,
  requestOptions: RequestInit,
  prefix?: string,
): Promise<void> {
  const maskSensitive = shouldMaskSensitive();
  const debugResponse = (process.env.NEXT_PUBLIC_DEBUG_API_RESPONSE || 'off').toLowerCase();
  if (debugResponse === 'off') return;
  if (!shouldLogEndpoint(url)) return;

  const status = response.status;
  const isError = status >= 400;
  const log = isError ? console.error : console.debug;
  const method = (requestOptions.method || 'GET').toUpperCase();
  const maskedUrl = maskSensitive ? maskSensitiveQueryParams(url) : url;
  const logPrefix = prefix ? `${prefix} [${method} ${status}]` : `[${method} ${status}]`;

  // We build an array of log parts and log them all at once at the end
  const logParts: any[] = [`${logPrefix} ${maskedUrl}`];

  // --- 1. Handle Headers ---
  const needsHeaders = debugResponse === 'status-headers' || debugResponse === 'full';
  if (needsHeaders) {
    let headers = Object.fromEntries(response.headers.entries());
    if (maskSensitive) {
      headers = maskHeaders(headers);
    }
    logParts.push('Headers:', headers);
  }

  // --- 2. Handle Body ---
  const needsBody = debugResponse.startsWith('status-body') || debugResponse === 'full';
  if (needsBody) {
    try {
      const bodyText = await response.clone().text();

      if (debugResponse.startsWith('status-body-')) {
        const limit = parseInt(debugResponse.split('-')[2], 10) || 200;
        logParts.push(`Body (max ${limit} chars):`, bodyText.slice(0, limit));
      } else {
        // This covers 'status-body' and 'full'
        logParts.push('Body:', bodyText);
      }
    } catch (err) {
      // Log the actual error for better debugging
      logParts.push('Error reading body:', err);
    }
  }

  // --- 3. Final Log ---
  // If debugResponse was 'status', only the logPrefix and URL are in the array.
  // Otherwise, headers and/or body have been added.
  log(...logParts);
}
