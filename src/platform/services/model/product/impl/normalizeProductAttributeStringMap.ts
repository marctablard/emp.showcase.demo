/**
 * Mixins often return numbers/booleans for template or variant fields; the Product model uses Record<string, string>.
 */
export function normalizeProductAttributeStringMap(
  raw: Record<string, unknown> | undefined,
): Record<string, string> | undefined {
  if (!raw) return undefined;
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, v == null ? '' : typeof v === 'string' ? v : String(v)]),
  );
}
