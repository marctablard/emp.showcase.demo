/**
 * Normalizes active filter `categoryIds` to unique id strings (browse URL / search state).
 */
export function parseCategoryIdsFilterValue(
  value: string | string[] | Record<string, string> | undefined | null,
): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (typeof value === 'string') {
    const t = value.trim();
    return t ? [t] : [];
  }
  if (Array.isArray(value)) {
    return [...new Set(value.map((v) => String(v).trim()).filter(Boolean))];
  }
  return [];
}
