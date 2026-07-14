/**
 * Read a session-context attribute whether Emporix stored it as a plain string
 * or as a `{ key, value }` attribute object.
 */
export function readSessionContextAttributeValue(
  context: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const raw = context?.[key];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed || undefined;
  }
  if (raw && typeof raw === 'object' && 'value' in raw) {
    const value = (raw as { value?: unknown }).value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed || undefined;
    }
  }
  return undefined;
}
