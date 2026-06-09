/**
 * Normalizes Emporix customer order GET …/transitions payloads to target status strings.
 * Wire format may be `string[]`, `{ status: string }[]`, or `{ transitions: … }`.
 */
export function normalizeCustomerOrderTransitionsPayload(raw: unknown): string[] {
  if (raw === null || raw === undefined) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.map((item, index) => {
      if (typeof item === 'string') {
        return item.trim();
      }
      if (item && typeof item === 'object' && 'status' in item) {
        const status = (item as { status: unknown }).status;
        if (typeof status === 'string') {
          return status.trim();
        }
      }
      throw new Error(`Invalid order transitions entry at index ${index}`);
    });
  }

  if (typeof raw !== 'object') {
    throw new Error('Invalid order transitions payload: expected array or object');
  }

  const record = raw as Record<string, unknown>;
  if ('transitions' in record) {
    return normalizeCustomerOrderTransitionsPayload(record.transitions);
  }

  throw new Error('Invalid order transitions payload: unrecognized object shape');
}
