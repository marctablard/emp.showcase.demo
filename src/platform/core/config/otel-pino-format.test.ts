import { Writable } from 'node:stream';
import pino from 'pino';
import { enrichOtelLog, formatOtelLevel, otelPinoFormatters, otelPinoTimestamp } from './otel-pino-format';

const ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const TRACE_KEYS = ['trace_id', 'span_id', 'TraceId', 'SpanId'] as const;

function expectNoTraceIds(record: Record<string, unknown>): void {
  for (const key of TRACE_KEYS) {
    expect(record).not.toHaveProperty(key);
  }
}

function capturePinoLine(write: (logger: pino.Logger) => void, options?: pino.LoggerOptions): Record<string, unknown> {
  let line = '';
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      line += String(chunk);
      callback();
    },
  });

  const logger = pino(
    {
      level: 'trace',
      timestamp: otelPinoTimestamp,
      formatters: otelPinoFormatters,
      ...options,
    },
    destination,
  );

  write(logger);

  expect(line).not.toBe('');
  return JSON.parse(line) as Record<string, unknown>;
}

describe('otelPinoTimestamp', () => {
  it('returns a Pino fragment with key timestamp and an ISO 8601 UTC value', () => {
    const fragment = otelPinoTimestamp();

    expect(fragment.startsWith(',"timestamp":"')).toBe(true);
    expect(fragment.endsWith('"')).toBe(true);
    expect(fragment).not.toContain('"time"');

    const parsed = JSON.parse(`{${fragment.slice(1)}}`) as { timestamp: string };
    expect(parsed.timestamp).toMatch(ISO_8601_UTC);
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
  });
});

describe('formatOtelLevel', () => {
  const cases: Array<[label: string, pinoLevel: number, severityText: string, severityNumber: number]> = [
    ['trace', 10, 'TRACE', 1],
    ['debug', 20, 'DEBUG', 5],
    ['info', 30, 'INFO', 9],
    ['warn', 40, 'WARN', 13],
    ['error', 50, 'ERROR', 17],
    ['fatal', 60, 'FATAL', 21],
  ];

  it.each(cases)(
    'maps %s to level, severity_text, and severity_number',
    (label, pinoLevel, severityText, severityNumber) => {
      expect(formatOtelLevel(label, pinoLevel)).toEqual({
        level: pinoLevel,
        severity_text: severityText,
        severity_number: severityNumber,
      });
    },
  );
});

describe('enrichOtelLog', () => {
  it('maps { err: Error } to dotted exception.* and drops err', () => {
    const err = new TypeError('boom');
    const result = enrichOtelLog({ err, path: '/cart' });

    expect(result).toEqual({
      path: '/cart',
      'exception.type': 'TypeError',
      'exception.message': 'boom',
      'exception.stacktrace': err.stack,
    });
    expect(result.err).toBeUndefined();
    expect(result.exception).toBeUndefined();
    expectNoTraceIds(result);
  });

  it('maps { err: string } to exception.message without a stack or type', () => {
    const result = enrichOtelLog({ err: 'not found', method: 'GET' });

    expect(result).toEqual({
      method: 'GET',
      'exception.message': 'not found',
    });
    expect(result).not.toHaveProperty('exception.type');
    expect(result).not.toHaveProperty('exception.stacktrace');
    expectNoTraceIds(result);
  });

  it('maps mixed { err: string, stack: string } and drops consumed keys', () => {
    const result = enrichOtelLog({
      err: 'wishlist failed',
      stack: 'Error: wishlist failed\n    at EmporixWishlistService',
      module: 'wishlist',
    });

    expect(result).toEqual({
      module: 'wishlist',
      'exception.type': 'Error',
      'exception.message': 'wishlist failed',
      'exception.stacktrace': 'Error: wishlist failed\n    at EmporixWishlistService',
    });
    expect(result.err).toBeUndefined();
    expect(result.stack).toBeUndefined();
    expectNoTraceIds(result);
  });

  it('uses sibling stack when error.stack is missing', () => {
    const error = new Error('ssr failed');
    Object.defineProperty(error, 'stack', { value: undefined });
    const stack = 'Error: ssr failed\n    at logRouteError';
    const result = enrichOtelLog({ error, stack, productId: 'p1' });

    expect(result).toEqual({
      productId: 'p1',
      'exception.type': 'Error',
      'exception.message': 'ssr failed',
      'exception.stacktrace': stack,
    });
  });

  it('maps { error: Error, stack } like step 1 and drops error / stack', () => {
    const error = new Error('ssr failed');
    const result = enrichOtelLog({ error, stack: 'ignored sibling', productId: 'p1' });

    expect(result['exception.type']).toBe('Error');
    expect(result['exception.message']).toBe('ssr failed');
    expect(result['exception.stacktrace']).toBe(error.stack);
    expect(result.productId).toBe('p1');
    expect(result.error).toBeUndefined();
    expect(result.stack).toBeUndefined();
    expectNoTraceIds(result);
  });

  it('maps flattened { error, stack } strings to exception.*', () => {
    const result = enrichOtelLog({
      error: 'route failed',
      stack: 'Error: route failed\n    at logRouteError',
      path: '/api/wishlist',
    });

    expect(result).toEqual({
      path: '/api/wishlist',
      'exception.type': 'Error',
      'exception.message': 'route failed',
      'exception.stacktrace': 'Error: route failed\n    at logRouteError',
    });
    expectNoTraceIds(result);
  });

  it('maps { error: string } without stack to exception.message only', () => {
    const result = enrichOtelLog({ error: 'missing product', productId: 'sku-1' });

    expect(result).toEqual({
      productId: 'sku-1',
      'exception.message': 'missing product',
    });
    expect(result).not.toHaveProperty('exception.type');
    expect(result).not.toHaveProperty('exception.stacktrace');
    expectNoTraceIds(result);
  });

  it('maps a plain err object with type / message / stack', () => {
    const result = enrichOtelLog({
      err: { type: 'RangeError', message: 'out of range', stack: 'RangeError: out of range' },
    });

    expect(result).toEqual({
      'exception.type': 'RangeError',
      'exception.message': 'out of range',
      'exception.stacktrace': 'RangeError: out of range',
    });
  });

  it('returns the same object when there is nothing to enrich', () => {
    const object = { module: 'cart', path: '/cart' };
    expect(enrichOtelLog(object)).toBe(object);
  });

  it('returns the same object when only stack is present', () => {
    const object = { stack: 'Error: leftover\n    at foo', module: 'cart' };
    expect(enrichOtelLog(object)).toBe(object);
  });

  it('maps a plain err object with name when type is missing', () => {
    const result = enrichOtelLog({
      err: { name: 'RangeError', message: 'out of range' },
    });

    expect(result).toEqual({
      'exception.type': 'RangeError',
      'exception.message': 'out of range',
    });
  });

  it('keeps a plain err object when exception-like keys are not strings', () => {
    const err = { message: 404, stack: true, name: 1, code: 'ENOENT' };
    const result = enrichOtelLog({ err, path: '/cart' });

    expect(result).toEqual({ err, path: '/cart' });
    expect(result).not.toHaveProperty('exception.message');
    expect(result).not.toHaveProperty('exception.type');
    expect(result).not.toHaveProperty('exception.stacktrace');
  });

  it('does not invent exception.* from a non-string, non-Error error object', () => {
    const result = enrichOtelLog({ error: { code: 500, detail: 'upstream' }, method: 'POST' });

    expect(result).toEqual({
      error: { code: 500, detail: 'upstream' },
      method: 'POST',
    });
    expect(result).not.toHaveProperty('exception.message');
  });

  it('does not emit trace_id or span_id placeholders', () => {
    const result = enrichOtelLog({ err: new Error('x') });
    expectNoTraceIds(result);
    expect(JSON.stringify(result)).not.toContain('trace_id');
    expect(JSON.stringify(result)).not.toContain('span_id');
    expect(JSON.stringify(result)).not.toContain('TraceId');
    expect(JSON.stringify(result)).not.toContain('SpanId');
  });
});

describe('otel Pino 10.3.1 wire format', () => {
  it('writes timestamp (not time) and severity fields on a captured JSON line', () => {
    const record = capturePinoLine((logger) => {
      logger.info({ module: 'otel-pino-format' }, 'hello');
    });

    expect(record.timestamp).toEqual(expect.stringMatching(ISO_8601_UTC));
    expect(record.time).toBeUndefined();
    expect(record.level).toBe(30);
    expect(record.severity_text).toBe('INFO');
    expect(record.severity_number).toBe(9);
    expect(record.module).toBe('otel-pino-format');
    expectNoTraceIds(record);
  });

  it('enriches a raw Error in formatters.log before serializers run', () => {
    const err = new Error('pre-serializer');
    const record = capturePinoLine(
      (logger) => {
        logger.error({ err }, 'failed');
      },
      {
        serializers: {
          err: () => ({ type: 'SERIALIZED', message: 'should-not-win' }),
        },
      },
    );

    expect(record['exception.type']).toBe('Error');
    expect(record['exception.message']).toBe('pre-serializer');
    expect(record['exception.stacktrace']).toBe(err.stack);
    expect(record.err).toBeUndefined();
    expect(record['exception.message']).not.toBe('should-not-win');
    expectNoTraceIds(record);
  });
});
