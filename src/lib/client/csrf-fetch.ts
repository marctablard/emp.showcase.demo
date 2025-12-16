'use client';

// Cache the token to avoid unnecessary requests
let csrfToken: string = '';

/**

/**
 * Gets the CSRF token from the server or cache
 * @returns CSRF token string
 */
export async function getCsrfToken(): Promise<string> {
  // Use cached token if available
  if (csrfToken) {
    return csrfToken;
  }

  try {
    const response = await fetch('/api/csrf', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'x-csrf-fetch': '1',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    csrfToken = data.token;
    if (!csrfToken) {
      throw new Error('Invalid CSRF token response');
    }

    return csrfToken;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    throw error;
  }
}

/**
 * Adds CSRF token to fetch options for non-GET requests
 * @param options Fetch options to enhance with CSRF token
 * @returns Enhanced fetch options with CSRF token header
 */
export async function withCsrf<T extends RequestInit>(options: T): Promise<T> {
  // Only add CSRF for state-changing methods
  if (options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())) {
    const token = await getCsrfToken();
    if (!options.headers) {
      options.headers = {};
    }

    // Add CSRF token to headers
    if (options.headers instanceof Headers) {
      options.headers.set('x-csrf-token', token);
    } else {
      (options.headers as Record<string, string>)['x-csrf-token'] = token;
    }
  }

  return options;
}

// This function sets up the CSRF-enhanced fetch override
// It should be called once in a client component
export function setupCsrfFetch() {
  // Only run in browser environment
  if (typeof window === 'undefined') return;

  const originalFetch = window.fetch;

  window.fetch = async function (input, init) {
    const url = input instanceof Request ? input.url : String(input);
    const method = init?.method || 'GET';

    // Check if this is a request to get the CSRF token
    // We need to bypass our CSRF logic for this specific request
    if (url.endsWith('/api/csrf') && init?.headers && (init.headers as any)['x-csrf-fetch'] === '1') {
      if (init.headers instanceof Headers) {
        init.headers.delete('x-csrf-fetch');
      } else if (typeof init.headers === 'object') {
        delete (init.headers as any)['x-csrf-fetch'];
      }
      return originalFetch(input, init);
    }

    // Skip CSRF for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
      return originalFetch(input, init);
    }

    // Only apply CSRF to same-origin requests
    const isRelativeOrSameDomain = url.startsWith('/') || url.startsWith(window.location.origin);
    if (!isRelativeOrSameDomain) {
      return originalFetch(input, init);
    }

    try {
      const requestInit = {
        method: method,
        headers: init?.headers || {},
      };

      const enhancedInit = await withCsrf(requestInit);
      const mergedInit = { ...init, ...enhancedInit };

      return originalFetch(input, mergedInit);
    } catch (_csrfError) {
      return originalFetch(input, init);
    }
  };
}
