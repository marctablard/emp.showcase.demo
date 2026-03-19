export type DebugApiOutput = 'terminal' | 'browser' | 'both';

export function getDebugApiOutput(): DebugApiOutput | null {
  const value = process.env.NEXT_PUBLIC_DEBUG_API_OUTPUT?.toLowerCase();
  if (value === 'terminal' || value === 'browser' || value === 'both') {
    return value;
  }
  return null;
}

export function getDebugApiResponseMode(): string | null {
  const value = process.env.NEXT_PUBLIC_DEBUG_API_RESPONSE?.toLowerCase();
  if (!value) return null;
  if (value === 'status' || value === 'status-headers' || value === 'status-body' || value === 'full') {
    return value;
  }
  if (/^status-body-\d+$/.test(value)) {
    return value;
  }
  return null;
}

export function isDebugApiResponseEnabled(): boolean {
  return getDebugApiResponseMode() !== null;
}

export function isBrowserDebugOutputEnabled(): boolean {
  const output = getDebugApiOutput();
  return output === 'browser' || output === 'both';
}

export function isTerminalDebugOutputEnabled(): boolean {
  const output = getDebugApiOutput();
  return output === 'terminal' || output === 'both';
}

export function isDebugApiEnabled(): boolean {
  return getDebugApiOutput() !== null && isDebugApiResponseEnabled();
}
