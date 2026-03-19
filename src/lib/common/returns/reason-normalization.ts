export function normalizeReasonCode(reasonCode: unknown): string | undefined {
  if (typeof reasonCode !== 'string') {
    return undefined;
  }

  const normalized = reasonCode.trim().toUpperCase();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeReasonDetails(reasonDetails: unknown): string | undefined {
  if (typeof reasonDetails !== 'string') {
    return undefined;
  }

  const normalized = reasonDetails.trim();
  return normalized.length > 0 ? normalized : undefined;
}
