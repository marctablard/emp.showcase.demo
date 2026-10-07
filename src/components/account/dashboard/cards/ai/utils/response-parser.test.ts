import { parseAIResponse, resolveCommittedChatPayload } from './response-parser';

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: jest.fn(),
}));

const { getLogger: mockGetLogger } = require('@/lib/logger/use-logger-client');
const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
};

describe('parseAIResponse', () => {
  beforeEach(() => {
    Object.values(mockLogger).forEach((fn) => fn.mockClear());
    mockGetLogger.mockReset();
    mockGetLogger.mockReturnValue(mockLogger);
  });

  it('should parse valid JSON response', () => {
    const input = JSON.stringify({ message: 'Hello', type: 'text', data: null });
    const result = parseAIResponse(input);
    expect(result.message).toBe('Hello');
    expect(result.type).toBe('text');
    expect(result.data).toBeNull();
  });

  it('should parse response with data', () => {
    const input = JSON.stringify({
      message: 'Here are your orders',
      type: 'order_list',
      data: { orders: [] },
    });
    const result = parseAIResponse(input);
    expect(result.message).toBe('Here are your orders');
    expect(result.type).toBe('order_list');
    expect(result.data).toEqual({ orders: [] });
  });

  it('should unwrap json code blocks', () => {
    const input = '```json\n{"message": "Hello", "type": "text"}\n```';
    const result = parseAIResponse(input);
    expect(result.message).toBe('Hello');
    expect(result.type).toBe('text');
  });

  it('should unwrap plain code blocks', () => {
    const input = '```\n{"message": "Hello", "type": "text"}\n```';
    const result = parseAIResponse(input);
    expect(result.message).toBe('Hello');
    expect(result.type).toBe('text');
  });

  it('should return raw message on parse failure', () => {
    const input = 'This is not JSON';
    const result = parseAIResponse(input);
    expect(result.message).toBe(input);
    expect(result.type).toBe('text');
    expect(result.data).toBeNull();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ rawMessage: 'This is not JSON', error: expect.any(String) }),
      'AI Response Parser: Raw message is not JSON',
    );
  });

  it('should extract cartRefresh flag when true', () => {
    const input = JSON.stringify({ message: 'Done', cartRefresh: true });
    const result = parseAIResponse(input);
    expect(result.cartRefresh).toBe(true);
  });

  it('should default cartRefresh to false', () => {
    const input = JSON.stringify({ message: 'Done' });
    const result = parseAIResponse(input);
    expect(result.cartRefresh).toBe(false);
  });

  it('does not use raw JSON as the shopper caption when the message field is missing', () => {
    const input = JSON.stringify({ type: 'text', data: null });
    const result = parseAIResponse(input);
    expect(result.message).toBe('');
    expect(result.type).toBe('text');
  });

  it('should return an empty message for structured widgets without a caption', () => {
    const input = JSON.stringify({
      type: 'html',
      data: { html: '<p>Hello</p>' },
    });
    const result = parseAIResponse(input);
    expect(result.message).toBe('');
    expect(result.type).toBe('html');
    expect(result.data).toEqual({ html: '<p>Hello</p>' });
  });

  it('should preserve an explicit empty message for widget envelopes', () => {
    const input = JSON.stringify({
      message: '',
      type: 'order_list',
      data: { orders: [{ orderId: 'EON1' }] },
    });
    const result = parseAIResponse(input);
    expect(result.message).toBe('');
    expect(result.type).toBe('order_list');
    expect(result.data).toEqual({ orders: [{ orderId: 'EON1' }] });
  });

  it('should handle empty string', () => {
    const result = parseAIResponse('');
    expect(result.message).toBe('');
    expect(result.type).toBe('text');
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ rawMessage: '', error: expect.any(String) }),
      'AI Response Parser: Raw message is not JSON',
    );
  });

  it('should handle complex data structures', () => {
    const data = {
      orders: [
        { id: '1', total: 100 },
        { id: '2', total: 200 },
      ],
      pagination: { page: 1, total: 2 },
    };
    const input = JSON.stringify({ message: 'Orders', type: 'order_list', data });
    const result = parseAIResponse(input);
    expect(result.data).toEqual(data);
  });

  it('unwraps a complete SSE envelope whose message is the widget JSON', () => {
    const widget = {
      message: "The product 'AuroraTech Smart Solar Solution' has been added to your cart.",
      type: 'cart_summary',
      data: { items: [{ productId: 'P1', quantity: 2 }], currency: 'EUR' },
      cartRefresh: true,
    };
    const result = parseAIResponse(
      JSON.stringify({
        type: 'complete',
        agentId: 'frontendAgent',
        sessionId: 'sess-1',
        message: JSON.stringify(widget),
      }),
    );
    expect(result.type).toBe('cart_summary');
    expect(result.message).toBe(widget.message);
    expect(result.data).toEqual(widget.data);
    expect(result.cartRefresh).toBe(true);
  });

  it('falls back to the live cart widget when parse has no structured payload', () => {
    const preview = {
      kind: 'widget' as const,
      type: 'cart_summary',
      message: 'Added to cart.',
      data: { items: [{ productId: 'P1' }], totalItems: 7 },
    };
    const committed = resolveCommittedChatPayload(parseAIResponse('Thanks.'), preview);
    expect(committed).toEqual({
      message: 'Thanks.',
      type: 'cart_summary',
      data: preview.data,
    });
  });

  it('reads a complete frontendAgent widget envelope without treating it as raw JSON', () => {
    const result = parseAIResponse(
      JSON.stringify({
        agentId: 'frontendAgent',
        sessionId: 'sess-1',
        message: 'Here are all your orders.',
        type: 'order_list',
        data: { orders: [{ orderId: 'EON1' }] },
      }),
    );
    expect(result.type).toBe('order_list');
    expect(result.message).toBe('Here are all your orders.');
    expect(result.data).toEqual({ orders: [{ orderId: 'EON1' }] });
  });

  it('unwraps a frontendAgent envelope without type complete', () => {
    const widget = {
      message: 'Here are all your orders.',
      type: 'order_list',
      data: { orders: [{ orderId: 'EON1' }] },
    };
    const result = parseAIResponse(
      JSON.stringify({
        agentId: 'frontendAgent',
        sessionId: 'sess-1',
        message: JSON.stringify(widget),
      }),
    );
    expect(result.type).toBe('order_list');
    expect(result.message).toBe(widget.message);
    expect(result.data).toEqual(widget.data);
  });

  it('unwraps a nested object message on an agent envelope', () => {
    const result = parseAIResponse(
      JSON.stringify({
        agentId: 'frontendAgent',
        sessionId: 'sess-1',
        message: {
          message: 'Here are all your orders.',
          type: 'order_list',
          data: { orders: [{ orderId: 'EON1' }] },
        },
      }),
    );
    expect(result.type).toBe('order_list');
    expect(result.message).toBe('Here are all your orders.');
    expect(result.data).toEqual({ orders: [{ orderId: 'EON1' }] });
  });

  it('extracts the shopper caption from incomplete envelope JSON', () => {
    const input =
      '{"agentId":"frontendAgent","sessionId":"3b823d4a-1d0f-46e1-9a68-9345dc3cacdc","message":"Here are all your orders. You can view details or request more information about any specific order.","type":"order_list","data":{"orders":[';
    const result = parseAIResponse(input);
    expect(result.message).toBe(
      'Here are all your orders. You can view details or request more information about any specific order.',
    );
    expect(result.type).toBe('text');
    expect(result.unparsedRaw).toBe(input);
  });

  it('does not commit a husk widget preview as an eternal skeleton', () => {
    const raw =
      '{"agentId":"frontendAgent","sessionId":"abc","message":"Here are all your orders.","type":"order_list","data":{"orders":[';
    const preview = {
      kind: 'widget' as const,
      type: 'order_list',
      message: 'Here are all your orders.',
      data: {},
    };
    const committed = resolveCommittedChatPayload(parseAIResponse(raw), preview, raw);
    expect(committed.type).toBe('unrecognized');
    expect(committed.message).toBe('Here are all your orders.');
    expect(typeof (committed.data as { previewJson?: string }).previewJson).toBe('string');
    expect(((committed.data as { previewJson: string }).previewJson.match(/\n/g) ?? []).length).toBeLessThan(5);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('commits a complete text envelope as plain text', () => {
    const raw = JSON.stringify({
      agentId: 'frontendAgent',
      sessionId: 'abc',
      message: 'The health status of your inverter is 45%.',
      type: 'text',
      data: { message: 'The health status of your inverter is 45%.', formatting: 'plain' },
    });
    const committed = resolveCommittedChatPayload(parseAIResponse(raw), undefined, raw);
    expect(committed.type).toBe('text');
    expect(committed.message).toBe('The health status of your inverter is 45%.');
  });

  it('commits a text envelope whose sentence is only in data.message', () => {
    const raw = JSON.stringify({ type: 'text', data: { message: 'Your order has been placed.', formatting: 'plain' } });
    const committed = resolveCommittedChatPayload(parseAIResponse(raw), undefined, raw);
    expect(committed.type).toBe('text');
    expect((committed.data as { message: string }).message).toBe('Your order has been placed.');
  });

  it('still falls back for a JSON dump without a shopper sentence', () => {
    const raw = JSON.stringify({ orders: [{ id: 'EON1' }] });
    const committed = resolveCommittedChatPayload(parseAIResponse(raw), undefined, raw);
    expect(committed.type).toBe('unrecognized');
  });
});
