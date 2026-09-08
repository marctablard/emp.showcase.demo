/**
 * First-party Pino formatters for opt-in OpenTelemetry-aligned stdout JSON.
 * Pure: no I/O, no env reads, no `server-only` (imported from logger-config on the client graph).
 *
 * timestamp is a Pino fragment (`,"timestamp":"…"`). Do not use stdTimeFunctions.isoTime (writes `time`).
 */

const OTEL_SEVERITY_NUMBER = {
  TRACE: 1,
  DEBUG: 5,
  INFO: 9,
  WARN: 13,
  ERROR: 17,
  FATAL: 21,
} as const;

type OtelSeverityText = keyof typeof OTEL_SEVERITY_NUMBER;

const EXCEPTION_TYPE = 'exception.type';
const EXCEPTION_MESSAGE = 'exception.message';
const EXCEPTION_STACKTRACE = 'exception.stacktrace';

/**
 * Pino `timestamp` callback: ISO 8601 UTC under the `timestamp` key.
 */
export function otelPinoTimestamp(): string {
  return `,"timestamp":"${new Date().toISOString()}"`;
}

/**
 * Keeps numeric `level` and adds OTel severity fields for the six Pino labels.
 */
export function formatOtelLevel(
  label: string,
  number: number,
): { level: number; severity_text: string; severity_number: number } {
  const severity_text = label.toUpperCase();
  const severity_number = OTEL_SEVERITY_NUMBER[severity_text as OtelSeverityText] ?? 0;
  return { level: number, severity_text, severity_number };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function assignErrorException(target: Record<string, unknown>, error: Error): void {
  target[EXCEPTION_TYPE] = error.name;
  target[EXCEPTION_MESSAGE] = error.message;
  if (typeof error.stack === 'string') {
    target[EXCEPTION_STACKTRACE] = error.stack;
  }
}

function exceptionTypeFromObject(err: Record<string, unknown>): string | undefined {
  if (typeof err.type === 'string') {
    return err.type;
  }
  if (typeof err.name === 'string') {
    return err.name;
  }
  return undefined;
}

function assignExceptionLikeObject(target: Record<string, unknown>, err: Record<string, unknown>): void {
  const type = exceptionTypeFromObject(err);
  if (type !== undefined) {
    target[EXCEPTION_TYPE] = type;
  }
  if (typeof err.message === 'string') {
    target[EXCEPTION_MESSAGE] = err.message;
  }
  if (typeof err.stack === 'string') {
    target[EXCEPTION_STACKTRACE] = err.stack;
  }
}

function hasMappableExceptionFields(value: Record<string, unknown>): boolean {
  return (
    typeof value.message === 'string' ||
    typeof value.stack === 'string' ||
    typeof value.type === 'string' ||
    typeof value.name === 'string'
  );
}

function assignStringException(target: Record<string, unknown>, message: string, stack: unknown): void {
  target[EXCEPTION_MESSAGE] = message;
  if (typeof stack === 'string') {
    target[EXCEPTION_STACKTRACE] = stack;
    target[EXCEPTION_TYPE] = 'Error';
  }
}

/**
 * Maps `{ err }` / `{ error, stack }` merge objects to dotted `exception.*` keys.
 * Runs in `formatters.log` before Pino serializers.
 */
export function enrichOtelLog(object: Record<string, unknown>): Record<string, unknown> {
  if (!('err' in object) && !('error' in object)) {
    return object;
  }

  const result: Record<string, unknown> = { ...object };
  const { err, error, stack } = result;

  if (err instanceof Error) {
    assignErrorException(result, err);
    delete result.err;
    return result;
  }

  if (typeof err === 'string') {
    assignStringException(result, err, stack);
    delete result.err;
    if (typeof stack === 'string') {
      delete result.stack;
    }
    return result;
  }

  if (isPlainObject(err) && hasMappableExceptionFields(err)) {
    assignExceptionLikeObject(result, err);
    delete result.err;
    return result;
  }

  if (error instanceof Error) {
    assignErrorException(result, error);
    if (result[EXCEPTION_STACKTRACE] === undefined && typeof stack === 'string') {
      result[EXCEPTION_STACKTRACE] = stack;
    }
    delete result.error;
    if (typeof stack === 'string') {
      delete result.stack;
    }
    return result;
  }

  if (typeof error === 'string') {
    assignStringException(result, error, stack);
    delete result.error;
    if (typeof stack === 'string') {
      delete result.stack;
    }
    return result;
  }

  return result;
}

export const otelPinoFormatters = {
  level: formatOtelLevel,
  log: enrichOtelLog,
};
