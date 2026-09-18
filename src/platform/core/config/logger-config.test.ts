import { Writable } from 'node:stream';
import pino from 'pino';
import { getClientLoggerConfig, getServerLoggerConfig, isOtelLoggingEnabled } from './logger-config';

const ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const TRACE_KEYS = ['trace_id', 'span_id', 'TraceId', 'SpanId'] as const;

const OFF_FLAG_VALUES = [undefined, '', 'TRUE', 'false', '1'] as const;

function expectNoTraceIds(record: Record<string, unknown>): void {
  for (const key of TRACE_KEYS) {
    expect(record).not.toHaveProperty(key);
  }
}

/** `NODE_ENV` is declared read-only on `NodeJS.ProcessEnv`; tests switch it through a property write. */
function setNodeEnv(value: string): void {
  Object.defineProperty(process.env, 'NODE_ENV', { value, configurable: true, enumerable: true, writable: true });
}

function setOtelFlag(value: string | undefined): void {
  if (value === undefined) {
    delete process.env.NEXT_LOG_OTEL_ENABLED;
  } else {
    process.env.NEXT_LOG_OTEL_ENABLED = value;
  }
}

function captureLogLine(write: (logger: pino.Logger) => void): Record<string, unknown> {
  let line = '';
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      line += String(chunk);
      callback();
    },
  });

  const config = getServerLoggerConfig({ includePrettyTransport: false });
  expect(config.transport).toBeUndefined();

  const logger = pino(config, destination);
  write(logger);

  expect(line).not.toBe('');
  return JSON.parse(line) as Record<string, unknown>;
}

describe('getServerLoggerConfig / getClientLoggerConfig', () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    delete process.env.NEXT_LOG_OTEL_ENABLED;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  describe('isOtelLoggingEnabled', () => {
    it.each(OFF_FLAG_VALUES)('is false when NEXT_LOG_OTEL_ENABLED is %j', (value) => {
      setOtelFlag(value);
      expect(isOtelLoggingEnabled()).toBe(false);
    });

    it('is true only for the exact string true', () => {
      setOtelFlag('true');
      expect(isOtelLoggingEnabled()).toBe(true);
    });
  });

  describe('off path', () => {
    it.each(OFF_FLAG_VALUES)('keeps current Pino keys when NEXT_LOG_OTEL_ENABLED is %j', (value) => {
      setOtelFlag(value);
      setNodeEnv('test');

      const config = getServerLoggerConfig();

      expect(config.messageKey).not.toBe('body');
      expect(config.formatters).toBeUndefined();
      expect(config.timestamp).toBeUndefined();
      expect(config.transport).toBeUndefined();
    });

    it('attaches a single pino-pretty transport in development', () => {
      setOtelFlag(undefined);
      setNodeEnv('development');

      const config = getServerLoggerConfig();

      expect(config.transport).toEqual({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      });
      expect(config.transport).not.toHaveProperty('targets');
      expect(config.messageKey).not.toBe('body');
      expect(config.formatters).toBeUndefined();
    });

    it('omits transport in development when includePrettyTransport is false', () => {
      setOtelFlag(undefined);
      setNodeEnv('development');

      const config = getServerLoggerConfig({ includePrettyTransport: false });

      expect(config.transport).toBeUndefined();
    });
  });

  describe('on path', () => {
    beforeEach(() => {
      setOtelFlag('true');
      setNodeEnv('test');
    });

    it('merges OTel formatter options without a pretty transport', () => {
      const config = getServerLoggerConfig();

      expect(config.messageKey).toBe('body');
      expect(config.timestamp).toBeDefined();
      expect(config.formatters?.level).toBeDefined();
      expect(config.formatters?.log).toBeDefined();
      expect(config.serializers?.err).toBe(pino.stdSerializers.err);
      expect(config.transport).toBeUndefined();
    });

    it('sets pretty timestampKey and messageKey when development pretty is included', () => {
      setNodeEnv('development');

      const config = getServerLoggerConfig();

      expect(config.transport).toEqual({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          timestampKey: 'timestamp',
          messageKey: 'body',
        },
      });
      expect(config.transport).not.toHaveProperty('targets');
    });

    it('never sets transport when includePrettyTransport is false, even in development', () => {
      setNodeEnv('development');

      const config = getServerLoggerConfig({ includePrettyTransport: false });

      expect(config.transport).toBeUndefined();
    });

    it('writes timestamp, severity, body, numeric level, and siblings on captured JSON', () => {
      const record = captureLogLine((logger) => {
        logger.info({ module: 'logger-config', path: '/api/cart' }, 'hello');
      });

      expect(record.timestamp).toEqual(expect.stringMatching(ISO_8601_UTC));
      expect(record.time).toBeUndefined();
      expect(record.severity_text).toBe('INFO');
      expect(record.severity_number).toBe(9);
      expect(record.body).toBe('hello');
      expect(record.msg).toBeUndefined();
      expect(record.level).toBe(30);
      expect(record.module).toBe('logger-config');
      expect(record.path).toBe('/api/cart');
      expectNoTraceIds(record);
    });

    it('emits exception.* for { err: Error }', () => {
      const err = new Error('server failed');
      const record = captureLogLine((logger) => {
        logger.error({ err, method: 'POST' }, 'failed');
      });

      expect(record['exception.type']).toBe('Error');
      expect(record['exception.message']).toBe('server failed');
      expect(record['exception.stacktrace']).toBe(err.stack);
      expect(record.method).toBe('POST');
      expect(record.body).toBe('failed');
      expect(record.err).toBeUndefined();
      expectNoTraceIds(record);
    });

    it('emits exception.* for flattened { error, stack }', () => {
      const record = captureLogLine((logger) => {
        logger.error(
          { error: 'route failed', stack: 'Error: route failed\n    at handler', path: '/api/wishlist' },
          'failed',
        );
      });

      expect(record['exception.type']).toBe('Error');
      expect(record['exception.message']).toBe('route failed');
      expect(record['exception.stacktrace']).toBe('Error: route failed\n    at handler');
      expect(record.path).toBe('/api/wishlist');
      expect(record.body).toBe('failed');
      expect(record.error).toBeUndefined();
      expect(record.stack).toBeUndefined();
      expectNoTraceIds(record);
    });
  });

  describe('client isolation', () => {
    it('does not add OTel formatters or messageKey body when the server flag is on', () => {
      setOtelFlag('true');

      // The client config type deliberately has no OTel keys; read it as generic Pino options to prove their absence.
      const config = getClientLoggerConfig() as pino.LoggerOptions;

      expect(config.messageKey).toBeUndefined();
      expect(config.formatters).toBeUndefined();
      expect(config.timestamp).toBeUndefined();
      expect(config.serializers?.err).toBe(pino.stdSerializers.err);
    });
  });
});
