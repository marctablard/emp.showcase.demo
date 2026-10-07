/**
 * In-flight coalescing key for mode-sensitive client fetches (COP-4822).
 * Product / variant / search / recommendation responses vary by products mode and customer,
 * so concurrent requests started under a different scope must not share a promise.
 *
 * Standard shape: `mode:siteCode:customerId[:extra]`
 * Last-seen validation: `products-mode-validation:mode:siteCode:customerId:ids`
 */
export function buildClientFetchScope(input: {
  mode?: string | null;
  siteCode?: string | null;
  customerId?: string | null;
  extra?: string | null;
}): string {
  const base = `${input.mode ?? ''}:${input.siteCode ?? ''}:${input.customerId ?? ''}`;
  return input.extra ? `${base}:${input.extra}` : base;
}

const VALIDATION_SCOPE_PREFIX = 'products-mode-validation';

/** URL / session site encoded in a `buildClientFetchScope` (or last-seen validation) key. */
export function requestSiteFromClientDedupeScope(clientDedupeScope: string): string | undefined {
  const parts = clientDedupeScope.split(':');
  const site = parts[0] === VALIDATION_SCOPE_PREFIX ? parts[2] : parts[1];
  const trimmed = site?.trim();
  return trimmed || undefined;
}

export function appendSiteQuery(path: string, siteCode?: string | null): string {
  const trimmed = siteCode?.trim();
  if (!trimmed) {
    return path;
  }
  return `${path}${path.includes('?') ? '&' : '?'}site=${encodeURIComponent(trimmed)}`;
}
