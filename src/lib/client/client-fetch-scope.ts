/**
 * In-flight coalescing key for mode-sensitive client fetches (COP-4822).
 * Product / variant / search / recommendation responses vary by products mode and customer,
 * so concurrent requests started under a different scope must not share a promise.
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
