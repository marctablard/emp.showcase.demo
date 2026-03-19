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

  // Heuristic fallback for "generic" probes with no clear UA:
  // Many probes send Accept: */* and lack typical browser headers.
  const accept = req.headers.get('accept') ?? '';
  const acceptLang = req.headers.get('accept-language') ?? '';
  const secFetchDest = req.headers.get('sec-fetch-dest') ?? '';
  const secFetchMode = req.headers.get('sec-fetch-mode') ?? '';
  const referer = req.headers.get('referer') ?? '';

  const looksNonBrowser =
    (accept === '*/*' || accept === '') &&
    acceptLang === '' &&
    secFetchDest === '' &&
    secFetchMode === '' &&
    referer === '' &&
    ua === ''; // Only consider it a probe if ALL conditions are met

  // HEAD is also common for health checks
  if (req.method === 'HEAD') return true;

  return looksNonBrowser;
}
