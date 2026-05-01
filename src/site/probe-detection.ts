// Shared constants and functions for health check probe detection
// Used by both middleware.ts and layout.tsx

export const PROBE_UA = /kube-probe|GoogleHC|ELB-HealthChecker|Azure-HealthCheck|curl|wget|python-requests|Prometheus/i;

export function isProbeUserAgent(userAgent: string): boolean {
  return PROBE_UA.test(userAgent);
}

export function isLikelyProbe(req: {
  headers: {
    get: (name: string) => string | null;
  };
  method: string;
}): boolean {
  const ua = req.headers.get('user-agent') ?? '';
  if (isProbeUserAgent(ua)) return true;

  // HEAD is also common for health checks
  if (req.method === 'HEAD') return true;

  // Real browser navigations (Playwright, Chrome, Firefox, etc.) send Fetch Metadata;
  // never treat them as infra probes — otherwise `/` returns a synthetic plain-text body
  // and E2E (and users) see an empty document without `<html lang>` or app shell.
  const secFetchMode = req.headers.get('sec-fetch-mode') ?? '';
  const secFetchDest = req.headers.get('sec-fetch-dest') ?? '';
  if (secFetchMode === 'navigate' || secFetchDest === 'document') {
    return false;
  }

  const accept = req.headers.get('accept') ?? '';
  if (accept.includes('text/html')) {
    return false;
  }

  // Heuristic fallback for "generic" probes with no clear UA:
  // Many probes send Accept: */* and lack typical browser headers.
  const acceptLang = req.headers.get('accept-language') ?? '';
  const referer = req.headers.get('referer') ?? '';

  const looksNonBrowser =
    (accept === '*/*' || accept === '') &&
    acceptLang === '' &&
    secFetchDest === '' &&
    secFetchMode === '' &&
    referer === '' &&
    ua === ''; // Only consider it a probe if ALL conditions are met

  return looksNonBrowser;
}
