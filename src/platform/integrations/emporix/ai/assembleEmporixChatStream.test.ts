import { parseAIResponse } from '@/components/account/dashboard/cards/ai/utils/response-parser';
import { assembleEmporixChatStream } from './assembleEmporixChatStream';

function toSseEvent(payload: string): string {
  return `data: ${payload}\n\n`;
}

// Observed (COP-5591 sibling parser): plain-text token + metadata-only.
// The additional fixture kinds are local observed-not-published compatibility mapping.
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
});
