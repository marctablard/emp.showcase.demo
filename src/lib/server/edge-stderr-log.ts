/**
 * Edge-only structured stderr logging. `LoggerService` / Pino are not available in Next.js Edge middleware.
 * Keep payloads operational (paths, events); avoid tokens and PII.
 */
/* eslint-disable no-console -- intentional Edge-only sink; see .cursor/rules/general.mdc */
export function edgeLog(level: 'warn' | 'error', event: string, fields?: Record<string, unknown>): void {
  const line = JSON.stringify(fields !== undefined ? { event, ...fields } : { event });
  if (level === 'warn') {
    console.warn(line);
  } else {
    console.error(line);
  }
}
