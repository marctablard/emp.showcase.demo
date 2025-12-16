import { parseAIResponse } from './response-parser';

describe('parseAIResponse', () => {
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

  it('should use raw message when parsed message is missing', () => {
    const input = JSON.stringify({ type: 'text', data: null });
    const result = parseAIResponse(input);
    expect(result.message).toBe(input);
  });

  it('should handle empty string', () => {
    const result = parseAIResponse('');
    expect(result.message).toBe('');
    expect(result.type).toBe('text');
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
});
