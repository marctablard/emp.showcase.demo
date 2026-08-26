import {
  buildUnrecognizedResponseData,
  firstJsonPreviewLines,
  looksLikeStructuredCaption,
  shopperCaptionFromRaw,
} from './unrecognized-response';

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('unrecognized-response helpers', () => {
  it('detects JSON-looking captions', () => {
    expect(looksLikeStructuredCaption('{ "agentId": "frontendAgent" }')).toBe(true);
    expect(looksLikeStructuredCaption('```json\n{}\n```')).toBe(true);
    expect(looksLikeStructuredCaption('Here are all your orders.')).toBe(false);
  });

  it('returns the first five pretty-printed JSON lines', () => {
    const preview = firstJsonPreviewLines({ a: 1, b: { c: 2 } });
    expect(preview.split('\n')).toHaveLength(5);
    expect(preview).toContain('"a": 1');
  });

  it('caps a single-line dump so the shopper never sees the full blob', () => {
    const preview = firstJsonPreviewLines(`{${'x'.repeat(400)}}`);
    expect(preview.length).toBeLessThanOrEqual(241);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('extracts the shopper message from an incomplete agent envelope', () => {
    const raw =
      '{"agentId":"frontendAgent","sessionId":"abc","message":"Here are all your orders.","type":"order_list","data":{"orders":[';
    expect(shopperCaptionFromRaw(raw)).toBe('Here are all your orders.');
  });

  it('previews data when present and the envelope when data is empty', () => {
    expect(buildUnrecognizedResponseData('{"x":1}', { orders: [{ id: '1' }] }).previewJson).toContain('orders');
    expect(buildUnrecognizedResponseData('{"agentId":"frontendAgent","message":"Hi"}', {}).previewJson).toContain(
      'agentId',
    );
  });
});
