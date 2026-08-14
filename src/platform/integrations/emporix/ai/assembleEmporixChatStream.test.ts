import { parseAIResponse } from '@/components/account/dashboard/cards/ai/utils/response-parser';
import { assembleEmporixChatStream } from './assembleEmporixChatStream';

function toSseEvent(payload: string): string {
  return `data: ${payload}\n\n`;
}

function toNamedSseEvent(eventName: string, payload: string): string {
  return `event:${eventName}\ndata: ${payload}\n\n`;
}

function toContentToken(content: string): string {
  return toNamedSseEvent('token', JSON.stringify({ content }));
}

// Observed (live frontendAgent chat-stream + COP-5591 sibling parser):
// token `{content}`, tool_* metadata, done without message, plain-text, one-shot envelopes.
describe('assembleEmporixChatStream', () => {
  it('concatenates non-JSON and JSON-string data payloads', async () => {
    const streamBody = `${toSseEvent('Hello, ')}${toSseEvent('"world!"')}`;

    await expect(assembleEmporixChatStream(streamBody)).resolves.toEqual({
      agentId: 'frontendAgent',
      agentType: 'generic',
      message: 'Hello, world!',
      sessionId: '',
    });
  });

  it('normalizes CRLF event separators the same as LF', async () => {
    const streamBody = 'data: Hello, \r\n\r\ndata: "world!"\r\n\r\n';

    await expect(assembleEmporixChatStream(streamBody)).resolves.toEqual({
      agentId: 'frontendAgent',
      agentType: 'generic',
      message: 'Hello, world!',
      sessionId: '',
    });
  });

  it('keeps published ChatResponse string message unchanged', async () => {
    const chatResponsePayload = JSON.stringify({
      agentId: 'frontendAgent',
      agentType: 'frontend',
      message: '{"message":"Order found","type":"order_list","data":{"orders":[]}}',
      sessionId: 'session-123',
    });

    const result = await assembleEmporixChatStream(toSseEvent(chatResponsePayload));

    expect(result).toEqual({
      agentId: 'frontendAgent',
      agentType: 'frontend',
      message: '{"message":"Order found","type":"order_list","data":{"orders":[]}}',
      sessionId: 'session-123',
    });
  });

  it('maps snake_case identity fields for ChatResponse-like payloads', async () => {
    const chatResponsePayload = JSON.stringify({
      agent_id: 'frontend-agent',
      agent_type: 'frontend',
      message: '{"message":"Orders","type":"order_list","data":{"orders":[{"id":"1"}]}}',
      session_id: 'session-snake',
    });

    const result = await assembleEmporixChatStream(toSseEvent(chatResponsePayload));

    expect(result).toEqual({
      agentId: 'frontend-agent',
      agentType: 'frontend',
      message: '{"message":"Orders","type":"order_list","data":{"orders":[{"id":"1"}]}}',
      sessionId: 'session-snake',
    });
  });

  it('ignores metadata-only snake_case done payloads and throws when stream has no message', async () => {
    const metadataOnlyPayload = JSON.stringify({
      agent_id: 'frontendAgent',
      session_id: 'session-123',
      ttft_ms: null,
      done: true,
    });

    await expect(assembleEmporixChatStream(toSseEvent(metadataOnlyPayload))).rejects.toThrow(
      'AI stream did not contain a message',
    );
  });

  it('preserves Frontend Agent envelope as stringified message for widget parsing', async () => {
    const frontendAgentPayload = {
      agent_id: 'frontendAgent',
      session_id: 'session-456',
      message: 'Found matching products',
      type: 'product_list',
      data: {
        products: [{ id: 'p-1' }],
      },
    };
    const streamBody = toSseEvent(JSON.stringify(frontendAgentPayload));

    const assembled = await assembleEmporixChatStream(streamBody);

    expect(assembled).toEqual({
      agentId: 'frontendAgent',
      agentType: '',
      message: JSON.stringify(frontendAgentPayload),
      sessionId: 'session-456',
    });

    const parsed = parseAIResponse(assembled.message);
    expect(parsed.type).toBe('product_list');
    expect(parsed.data).toEqual({ products: [{ id: 'p-1' }] });
  });

  it('throws on empty body', async () => {
    await expect(assembleEmporixChatStream('')).rejects.toThrow('AI stream did not contain a message');
  });

  it('throws when captured message is empty string', async () => {
    const emptyMessagePayload = JSON.stringify({
      agentId: 'frontendAgent',
      agentType: 'frontend',
      message: '',
      sessionId: 'session-123',
    });

    await expect(assembleEmporixChatStream(toSseEvent(emptyMessagePayload))).rejects.toThrow(
      'AI stream contained an empty message',
    );
  });

  it('keeps markdown-fenced JSON as plain text when stream payload is not valid JSON', async () => {
    const markdownFencedJson = '```json\n{"message":"Hello","type":"text"}\n```';
    const streamBody = `data: \`\`\`json\ndata: {"message":"Hello","type":"text"}\ndata: \`\`\`\n\n`;

    await expect(assembleEmporixChatStream(streamBody)).resolves.toEqual({
      agentId: 'frontendAgent',
      agentType: 'generic',
      message: markdownFencedJson,
      sessionId: '',
    });
  });

  it('ignores keepalive comment lines', async () => {
    const streamBody = `: keepalive ping\n\n${toSseEvent('"pong"')}`;

    await expect(assembleEmporixChatStream(streamBody)).resolves.toEqual({
      agentId: 'frontendAgent',
      agentType: 'generic',
      message: 'pong',
      sessionId: '',
    });
  });

  it('reassembles live frontendAgent token content into a widget envelope', async () => {
    const frontendAgentPayload = {
      agentId: 'frontendAgent',
      sessionId: 'session-live',
      message: 'Here are the details of your most recent order.',
      type: 'order_summary',
      data: { orders: [{ id: 'order-1' }] },
      timestamp: '2026-08-14T00:00:00.000Z',
      cartRefresh: false,
    };
    const envelopeJson = JSON.stringify(frontendAgentPayload, null, 2);
    const contentChunks = [envelopeJson.slice(0, 24), envelopeJson.slice(24, 80), envelopeJson.slice(80)];
    const streamBody = [
      toNamedSseEvent('tool_start', JSON.stringify({ tool_name: 'get-customer-orders', tool_call_id: 'call-1' })),
      toNamedSseEvent('tool_end', JSON.stringify({ tool_name: 'get-customer-orders', tool_call_id: 'call-1' })),
      ':keepalive\n\n',
      ...contentChunks.map((chunk) => toContentToken(chunk)),
      toNamedSseEvent(
        'done',
        JSON.stringify({
          agent_id: 'frontendAgent',
          agent_type: 'generic',
          session_id: 'session-live',
          tools_used: ['get-customer-orders'],
          ttft_ms: 12.5,
        }),
      ),
    ].join('');

    const assembled = await assembleEmporixChatStream(streamBody);

    expect(assembled.agentId).toBe('frontendAgent');
    expect(assembled.sessionId).toBe('session-live');
    expect(assembled.message).toBe(JSON.stringify(frontendAgentPayload));

    const parsed = parseAIResponse(assembled.message);
    expect(parsed.type).toBe('order_summary');
    expect(parsed.data).toEqual({ orders: [{ id: 'order-1' }] });
    expect(parsed.message).toBe('Here are the details of your most recent order.');
  });

  it('concatenates token content as plain text and overlays done identity', async () => {
    const streamBody = [
      toContentToken('Hello, '),
      toContentToken('world!'),
      toNamedSseEvent(
        'done',
        JSON.stringify({
          agent_id: 'frontendAgent',
          agent_type: 'generic',
          session_id: 'session-text',
        }),
      ),
    ].join('');

    await expect(assembleEmporixChatStream(streamBody)).resolves.toEqual({
      agentId: 'frontendAgent',
      agentType: 'generic',
      message: 'Hello, world!',
      sessionId: 'session-text',
    });
  });
});
