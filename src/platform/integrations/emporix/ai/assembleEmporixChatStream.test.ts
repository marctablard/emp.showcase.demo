import { parseAIResponse } from '@/components/account/dashboard/cards/ai/utils/response-parser';
import type { AIChatStreamProgressUpdate } from '@/lib/common/ai-stream-preview';
import { assembleEmporixChatStream } from './assembleEmporixChatStream';

type QuoteListWidgetData = { quotes?: Array<{ id?: string; quoteId?: string }> };
type ProductListWidgetData = { products?: unknown[] };

/** Widget previews carry `data: unknown`; tests narrow it to the widget payload they assert on. */
function widgetData<T>(update: AIChatStreamProgressUpdate): T | undefined {
  return update.preview?.kind === 'widget' ? (update.preview.data as T | undefined) : undefined;
}

function toSseEvent(payload: string): string {
  return `data: ${payload}\n\n`;
}

function toNamedSseEvent(eventName: string, payload: string): string {
  return `event:${eventName}\ndata: ${payload}\n\n`;
}

function toContentToken(content: string): string {
  return toNamedSseEvent('token', JSON.stringify({ content }));
}

// Observed (live frontendAgent chat-stream + sibling parser):
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
      agentType: 'generic',
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

  it('extracts a fenced Frontend Agent envelope when the SSE payload is not one JSON value', async () => {
    const envelope = { message: 'Hello', type: 'text' };
    const streamBody = `data: \`\`\`json\ndata: ${JSON.stringify(envelope)}\ndata: \`\`\`\n\n`;

    const assembled = await assembleEmporixChatStream(streamBody);

    expect(assembled).toEqual({
      agentId: 'frontendAgent',
      agentType: 'generic',
      message: JSON.stringify(envelope),
      sessionId: '',
    });
    expect(parseAIResponse(assembled.message).message).toBe('Hello');
  });

  it('keeps markdown that is not a widget envelope as plain text', async () => {
    const markdown = '```\nnot-json\n```';
    const streamBody = `data: \`\`\`\ndata: not-json\ndata: \`\`\`\n\n`;

    await expect(assembleEmporixChatStream(streamBody)).resolves.toEqual({
      agentId: 'frontendAgent',
      agentType: 'generic',
      message: markdown,
      sessionId: '',
    });
  });

  it('drops fenced tool JSON and keeps the later Frontend Agent envelope', async () => {
    const toolQuery = { query: 'pending orders OR open orders', filter: 'NO_FILTER' };
    const frontendAgentPayload = {
      agentId: 'frontendAgent',
      sessionId: 'session-orders',
      message: 'Here are your current pending orders.',
      type: 'order_list',
      data: { orders: [{ orderId: 'EON1605' }], pagination: { page: 1, totalPages: 1, totalItems: 1 } },
      timestamp: '2024-06-13T10:25:00Z',
      cartRefresh: false,
    };
    const fencedTool = `\`\`\`json\n${JSON.stringify(toolQuery, null, 2)}\n\`\`\``;
    const envelopeJson = JSON.stringify(frontendAgentPayload, null, 2);
    const concatenated = `${fencedTool}\n${envelopeJson}`;
    const contentChunks = [concatenated.slice(0, 40), concatenated.slice(40, 120), concatenated.slice(120)];
    const streamBody = [
      toNamedSseEvent(
        'tool_start',
        JSON.stringify({ tool_name: 'search_showcasedev__indexedOrders', tool_call_id: 'call-1' }),
      ),
      ...contentChunks.map((chunk) => toContentToken(chunk)),
      toNamedSseEvent(
        'tool_end',
        JSON.stringify({ tool_name: 'search_showcasedev__indexedOrders', tool_call_id: 'call-1' }),
      ),
      toNamedSseEvent(
        'done',
        JSON.stringify({
          agent_id: 'frontendAgent',
          agent_type: 'generic',
          session_id: 'session-orders',
          tools_used: ['search_showcasedev__indexedOrders'],
        }),
      ),
    ].join('');

    const assembled = await assembleEmporixChatStream(streamBody);
    const parsed = parseAIResponse(assembled.message);

    expect(assembled.sessionId).toBe('session-orders');
    expect(parsed.type).toBe('order_list');
    expect(parsed.message).toBe('Here are your current pending orders.');
    expect(parsed.data).toEqual(frontendAgentPayload.data);
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

  it('omits preview payload on coalesced token frames within one SSE batch', async () => {
    const progressUpdates: Array<{ chunks: number; preview?: { kind: string; content?: string } }> = [];
    const streamBody = [toContentToken('Hello, '), toContentToken('world'), toContentToken('!')].join('');

    await assembleEmporixChatStream(streamBody, (progress) => {
      progressUpdates.push(progress);
    });

    expect(progressUpdates[0]).toEqual({ chunks: 1, preview: { kind: 'text', content: 'Hello, ' } });
    expect(progressUpdates[1]).toEqual({ chunks: 2 });
    expect(progressUpdates[2]).toEqual({ chunks: 3 });
  });

  it('reports progress after each SSE data payload, including split stream chunks', async () => {
    const progressUpdates: Array<{ chunks: number; preview?: { kind: string; content?: string } }> = [];
    const first = toContentToken('Hello, ');
    const second = toContentToken('world!');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(first.slice(0, 12)));
        controller.enqueue(encoder.encode(first.slice(12)));
        controller.enqueue(encoder.encode(second));
        controller.close();
      },
    });

    const assembled = await assembleEmporixChatStream(stream, (progress) => {
      progressUpdates.push(progress);
    });

    expect(assembled.message).toBe('Hello, world!');
    expect(progressUpdates).toEqual([
      { chunks: 1, preview: { kind: 'text', content: 'Hello, ' } },
      { chunks: 2, preview: { kind: 'text', content: 'Hello, world!' } },
    ]);
  });

  it('streams a widget skeleton after a leading tool fence, without painting incomplete order JSON', async () => {
    const progressUpdates: Array<{
      chunks: number;
      preview?: { kind: string; content?: string; type?: string; data?: unknown };
    }> = [];
    const frontendAgentPayload = {
      agentId: 'frontendAgent',
      sessionId: 'session-orders',
      message: 'Here are your current pending orders.',
      type: 'order_list',
      data: { orders: [{ orderId: 'EON1605' }] },
    };
    const toolFence = '```json\n{"query":"pending orders","filter":"NO_FILTER"}\n```\n';
    const envelopeJson = JSON.stringify(frontendAgentPayload);
    const contentChunks = [envelopeJson.slice(0, 40), envelopeJson.slice(40, 90), envelopeJson.slice(90)];
    const streamBody = `${toolFence}${contentChunks.map((chunk) => toContentToken(chunk)).join('')}`;

    await assembleEmporixChatStream(streamBody, (progress) => {
      progressUpdates.push(progress);
    });

    const widgetPreviews = progressUpdates.filter((update) => update.preview?.kind === 'widget');
    expect(widgetPreviews.length).toBeGreaterThan(0);
    expect(widgetPreviews.some((update) => JSON.stringify(update.preview?.data ?? {}).includes('EON1605'))).toBe(true);
    expect(widgetPreviews.at(-1)?.preview).toEqual({
      kind: 'widget',
      type: 'order_list',
      message: 'Here are your current pending orders.',
      data: { orders: [{ orderId: 'EON1605' }] },
    });
  });

  it('forwards html preview after a leading tool fence during token streaming', async () => {
    const progressUpdates: Array<{ chunks: number; preview?: { kind: string; html?: string } }> = [];
    const toolFence = '```json\n{"query":"profile","filter":"NO_FILTER"}\n```\n';
    const envelope = '{"type":"html","data":{"html":"<p>Hello';
    const streamBody = `${toolFence}${toContentToken(envelope.slice(0, 20))}${toContentToken(envelope.slice(20))}`;

    await assembleEmporixChatStream(streamBody, (progress) => {
      progressUpdates.push(progress);
    });

    expect(progressUpdates.some((update) => update.preview?.kind === 'html')).toBe(true);
    expect(progressUpdates.at(-1)?.preview).toEqual({ kind: 'html', html: '<p>Hello' });
  });

  it('completes caption-less html envelopes without empty message', async () => {
    const envelope = JSON.stringify({
      type: 'html',
      message: '',
      data: { html: '<p>Hello</p>' },
    });
    const streamBody = toContentToken(envelope);

    const assembled = await assembleEmporixChatStream(streamBody);

    expect(assembled.message).not.toBe('');
    const parsed = JSON.parse(assembled.message);
    expect(parsed.type).toBe('html');
    expect(parsed.data.html).toBe('<p>Hello</p>');
  });

  it('throws when upstream emits event:error', async () => {
    const streamBody = toNamedSseEvent('error', JSON.stringify({ error: 'Upstream failed' }));

    await expect(assembleEmporixChatStream(streamBody)).rejects.toThrow('Upstream failed');
  });

  it('completes empty quote_list tool results without throwing', async () => {
    const streamBody = [
      toNamedSseEvent('tool_start', JSON.stringify({ tool_name: 'get-quotes', tool_call_id: 'call-1' })),
      toNamedSseEvent(
        'tool_result',
        JSON.stringify({
          tool_name: 'get-quotes',
          tool_call_id: 'call-1',
          output: { quotes: [] },
        }),
      ),
    ].join('');

    const assembled = await assembleEmporixChatStream(streamBody);
    const parsed = JSON.parse(assembled.message);

    expect(parsed.type).toBe('quote_list');
    expect(parsed.data.quotes).toEqual([]);
  });

  it('fails closed when the stream contains only a fenced tool payload', async () => {
    const toolQuery = { query: 'pending orders', filter: 'NO_FILTER' };
    const streamBody = toContentToken(`\`\`\`json\n${JSON.stringify(toolQuery)}\n\`\`\``);

    await expect(assembleEmporixChatStream(streamBody)).rejects.toThrow('AI stream contained an empty message');
  });

  it('applies done-frame identity over envelopes that omit agentId', async () => {
    const envelope = JSON.stringify({
      message: 'Here are your orders.',
      type: 'order_list',
      data: { orders: [{ orderId: 'EON1' }] },
    });
    const streamBody = [
      toContentToken(envelope),
      toNamedSseEvent(
        'done',
        JSON.stringify({ agent_id: 'frontend-agent', agent_type: 'frontend', session_id: 'session-overlay' }),
      ),
    ].join('');

    const assembled = await assembleEmporixChatStream(streamBody);

    expect(assembled.agentId).toBe('frontend-agent');
    expect(assembled.agentType).toBe('frontend');
    expect(assembled.sessionId).toBe('session-overlay');
  });

  it('prefers the adapted tool widget over a larger raw token envelope', async () => {
    const streamBody = [
      toNamedSseEvent(
        'tool_result',
        JSON.stringify({
          tool_name: 'get-customer-orders',
          tool_call_id: 'call-1',
          output: { orders: [{ id: 'EON1', totalPrice: 10 }] },
        }),
      ),
      toContentToken(
        JSON.stringify({
          agentId: 'frontendAgent',
          sessionId: 'session-raw',
          message: 'Here are your orders.',
          type: 'order_list',
          data: {
            orders: [{ orderId: 'EON1', mixins: { debug: true }, total: { amount: 999, currency: 'EUR' } }],
          },
        }),
      ),
    ].join('');

    const assembled = await assembleEmporixChatStream(streamBody);
    const parsed = JSON.parse(assembled.message);

    expect(parsed.type).toBe('order_list');
    expect(parsed.data.orders[0]).toMatchObject({ orderId: 'EON1', total: { gross: 10, value: 10 } });
    expect(parsed.data.orders[0]).not.toHaveProperty('mixins');
  });

  describe('when the agent reads the customer before listing products', () => {
    const customerResult = toNamedSseEvent(
      'tool_result',
      JSON.stringify({
        tool_name: 'get-customer-info',
        tool_call_id: 'call-customer',
        output: {
          id: 'C1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          contactEmail: 'ada@example.com',
          mixins: { ownedproducts: { ownedproducts: [{ productid: 'P1' }] } },
        },
      }),
    );
    const productsResult = toNamedSseEvent(
      'tool_result',
      JSON.stringify({
        tool_name: 'get-products',
        tool_call_id: 'call-products',
        output: { products: [{ id: 'P1', name: { en: 'Inverter X1' } }] },
      }),
    );
    const envelope = (type: string) =>
      toContentToken(JSON.stringify({ agentId: 'frontendAgent', message: 'Here you go.', type }));

    it('shows the product list the agent declared even when get-customer-info ran last', async () => {
      const assembled = await assembleEmporixChatStream(
        [productsResult, customerResult, envelope('product_list')].join(''),
      );
      const parsed = JSON.parse(assembled.message);

      expect(parsed.type).toBe('product_list');
      expect(parsed.data.products).toHaveLength(1);
    });

    it('fills a declared product_selection from the get-products result', async () => {
      const assembled = await assembleEmporixChatStream(
        [customerResult, productsResult, customerResult, envelope('product_selection')].join(''),
      );
      const parsed = JSON.parse(assembled.message);

      expect(parsed.type).toBe('product_list');
      expect(parsed.data.products).toHaveLength(1);
    });

    it('does not paint the account card when the declared widget has no matching tool result', async () => {
      const assembled = await assembleEmporixChatStream([customerResult, envelope('product_list')].join(''));
      const parsed = JSON.parse(assembled.message);

      expect(parsed.type).toBe('product_list');
      expect(parsed.message).toBe('Here you go.');
    });

    it('never previews the account card while the agent is still looking up products', async () => {
      const progressUpdates: AIChatStreamProgressUpdate[] = [];
      await assembleEmporixChatStream([customerResult, productsResult, envelope('product_list')].join(''), (progress) =>
        progressUpdates.push(progress),
      );
      const widgetTypes = progressUpdates
        .map((update) => (update.preview?.kind === 'widget' ? update.preview.type : null))
        .filter(Boolean);

      expect(widgetTypes.length).toBeGreaterThan(0);
      expect(new Set(widgetTypes)).toEqual(new Set(['product_list']));
      expect(widgetData<ProductListWidgetData>(progressUpdates.at(-1)!)?.products).toHaveLength(1);
    });

    it('answers in text when the agent read the customer only to look up a rule', async () => {
      const assembled = await assembleEmporixChatStream(
        [
          customerResult,
          toContentToken(
            JSON.stringify({
              agentId: 'frontendAgent',
              message: 'Coolants must be ordered in 20 l containers.',
              type: 'text',
              data: null,
            }),
          ),
        ].join(''),
      );
      const parsed = JSON.parse(assembled.message);

      expect(parsed.type).toBe('text');
      expect(parsed.message).toBe('Coolants must be ordered in 20 l containers.');
      expect(assembled.message).not.toContain('Lovelace');
    });

    it('builds a declared address_list from the customer addresses when no address tool ran', async () => {
      const customerWithAddress = toNamedSseEvent(
        'tool_result',
        JSON.stringify({
          tool_name: 'get-customer-info',
          tool_call_id: 'call-customer',
          output: {
            id: 'C1',
            firstName: 'Ada',
            addresses: [{ id: 'A1', street: 'Main St', streetNumber: '1', zipCode: '10115', city: 'Berlin' }],
          },
        }),
      );
      const assembled = await assembleEmporixChatStream([customerWithAddress, envelope('address_list')].join(''));
      const parsed = JSON.parse(assembled.message);

      expect(parsed.type).toBe('address_list');
      expect(parsed.data.addresses).toEqual([expect.objectContaining({ id: 'A1', city: 'Berlin' })]);
    });

    it('keeps the account card when the agent declares account_details', async () => {
      const assembled = await assembleEmporixChatStream([customerResult, envelope('account_details')].join(''));

      expect(JSON.parse(assembled.message).type).toBe('account_details');
    });
  });

  it('paints no card from get-quotes tool frames before the agent declares a widget, then returns two quotes', async () => {
    const progressUpdates: AIChatStreamProgressUpdate[] = [];
    const streamBody = [
      toNamedSseEvent('tool_start', JSON.stringify({ tool_name: 'get-quotes', tool_call_id: 'call-1' })),
      toNamedSseEvent(
        'tool_result',
        JSON.stringify({
          tool_name: 'get-quotes',
          tool_call_id: 'call-1',
          output: {
            quotes: [
              { id: 'Q1', reference: 'R1' },
              { id: 'Q2', reference: 'R2' },
            ],
          },
        }),
      ),
      toContentToken('Here are your quotes.'),
    ].join('');

    const assembled = await assembleEmporixChatStream(streamBody, (progress) => {
      progressUpdates.push(progress);
    });

    expect(progressUpdates.some((update) => update.preview?.kind === 'widget')).toBe(false);
    const parsed = JSON.parse(assembled.message);
    expect(parsed.data.quotes.map((quote: { id?: string; quoteId?: string }) => quote.id ?? quote.quoteId)).toEqual([
      'Q1',
      'Q2',
    ]);
    expect(parsed.type).toBe('quote_list');
    expect(parsed.message).toBe('Here are your quotes.');
    expect(parsed.data.quotes).toHaveLength(2);
  });

  it('keeps tool_result widgets when trailing tokens are not a complete envelope', async () => {
    const streamBody = [
      toNamedSseEvent(
        'tool_result',
        JSON.stringify({
          tool_name: 'get-customer-orders',
          tool_call_id: 'call-1',
          output: { orders: [{ id: 'EON1' }] },
        }),
      ),
      toContentToken('not-json-yet'),
    ].join('');

    const assembled = await assembleEmporixChatStream(streamBody);
    const parsed = JSON.parse(assembled.message);
    expect(parsed.type).toBe('order_list');
    expect(parsed.message).toBe('not-json-yet');
    expect(parsed.data.orders[0].orderId).toBe('EON1');
  });

  it('shows no account skeleton on get-customer-info tool_start', async () => {
    const progressUpdates: Array<{ chunks: number; preview?: { kind: string; type?: string; data?: unknown } }> = [];
    const streamBody = toNamedSseEvent(
      'tool_start',
      JSON.stringify({ tool_name: 'showcasedev__get-customer-info', tool_call_id: 'call-1' }),
    );

    const assembled = await assembleEmporixChatStream(streamBody, (progress) => {
      progressUpdates.push(progress);
    }).catch(() => undefined);

    expect(assembled).toBeUndefined();
    expect(progressUpdates.some((update) => update.preview?.kind === 'widget')).toBe(false);
  });

  it('maps get-customer-info tool_result onto personalInfo', async () => {
    const streamBody = [
      toNamedSseEvent('tool_start', JSON.stringify({ tool_name: 'get-customer-info', tool_call_id: 'call-1' })),
      toNamedSseEvent(
        'tool_result',
        JSON.stringify({
          tool_name: 'get-customer-info',
          tool_call_id: 'call-1',
          output: {
            firstName: 'Ada',
            lastName: 'Lovelace',
            contactEmail: 'ada@example.com',
            addresses: [
              { name: 'HQ', addressLine1: '1 Analytical Way', city: 'London', postalCode: 'SW1A', country: 'GB' },
            ],
          },
        }),
      ),
      toContentToken('Here is your account information.'),
    ].join('');

    const assembled = await assembleEmporixChatStream(streamBody);
    const parsed = JSON.parse(assembled.message);
    expect(parsed.type).toBe('account_details');
    expect(parsed.data.personalInfo.name).toBe('Ada Lovelace');
    expect(parsed.data.personalInfo.email).toBe('ada@example.com');
    expect(parsed.data.addresses[0].city).toBe('London');
  });

  it('sets cartRefresh on get-cart tool_result cart_summary completes', async () => {
    const streamBody = [
      toNamedSseEvent('tool_start', JSON.stringify({ tool_name: 'get-cart', tool_call_id: 'call-1' })),
      toNamedSseEvent(
        'tool_result',
        JSON.stringify({
          tool_name: 'get-cart',
          tool_call_id: 'call-1',
          output: {
            currency: 'EUR',
            siteCode: 'main',
            items: [{ productId: 'P1', name: 'Solar panel', quantity: 1 }],
            subtotal: { gross: 99, currency: 'EUR' },
            total: { gross: 99, currency: 'EUR' },
          },
        }),
      ),
      toContentToken('Your cart is updated.'),
    ].join('');

    const assembled = await assembleEmporixChatStream(streamBody);
    const parsed = parseAIResponse(assembled.message);
    expect(parsed.type).toBe('cart_summary');
    expect(parsed.cartRefresh).toBe(true);
    expect(parsed.data).toMatchObject({
      currency: 'EUR',
      siteCode: 'main',
      total: { gross: 99, currency: 'EUR' },
    });
  });

  it('does not paint get-customer-info as the shopper name when the tool envelope is empty', async () => {
    const streamBody = [
      toNamedSseEvent('tool_start', JSON.stringify({ tool_name: 'get-customer-info', tool_call_id: 'call-1' })),
      toNamedSseEvent(
        'tool_result',
        JSON.stringify({
          tool_name: 'get-customer-info',
          tool_call_id: 'call-1',
          output: { name: 'get-customer-info', type: 'tool', tool_call_id: 'call-1' },
        }),
      ),
      toContentToken(
        JSON.stringify({
          message: 'Here is your profile information.',
          type: 'account_details',
          data: {
            personalInfo: {
              name: 'Szymon Mendla',
              email: 's.mendla@emporix.com',
              company: 'SpaceX',
              customerNumber: '26566461',
            },
            addresses: [{ city: 'Belrin', country: 'Germany' }],
          },
        }),
      ),
    ].join('');

    const assembled = await assembleEmporixChatStream(streamBody);
    const parsed = JSON.parse(assembled.message);
    expect(parsed.type).toBe('account_details');
    expect(parsed.data.personalInfo).toMatchObject({
      name: 'Szymon Mendla',
      email: 's.mendla@emporix.com',
      company: 'SpaceX',
    });
    expect(parsed.data.personalInfo.name).not.toBe('get-customer-info');
  });

  it('keeps adapted get-products tool_result when token JSON is larger', async () => {
    const fatTokenProduct = {
      id: 'P1',
      name: { en: 'Super 8 Blanche' },
      description: { en: '<p>Crisp lager</p>' },
      mixins: { specs: { alcohol: '5%', origin: 'Belgium', packaging: 'can' } },
    };
    const streamBody = [
      toNamedSseEvent(
        'tool_result',
        JSON.stringify({
          tool_name: 'get-products',
          tool_call_id: 'call-1',
          output: {
            products: [
              {
                id: 'P1',
                name: { en: 'Super 8 Blanche' },
                description: { en: '<p>Crisp lager</p>' },
                media: { url: 'https://cdn.example/p1.jpg' },
                price: { amount: 12.5, currency: 'EUR' },
              },
            ],
          },
        }),
      ),
      toContentToken(
        JSON.stringify({
          message: 'Here are five products.',
          type: 'product_list',
          data: {
            products: [fatTokenProduct, fatTokenProduct, fatTokenProduct],
          },
        }),
      ),
    ].join('');

    const assembled = await assembleEmporixChatStream(streamBody);
    const parsed = JSON.parse(assembled.message);
    expect(parsed.type).toBe('product_list');
    expect(parsed.data.products).toHaveLength(1);
    expect(parsed.data.products[0]).toEqual({
      productId: 'P1',
      name: 'Super 8 Blanche',
      description: '<p>Crisp lager</p>',
      image: 'https://cdn.example/p1.jpg',
      price: 12.5,
      currency: 'EUR',
    });
    expect(parsed.data.products[0]).not.toHaveProperty('mixins');
  });

  it('drops multi-section planning captions from progress when tool_result fills order_list', async () => {
    const progressUpdates: Array<{ preview?: { kind: string; message?: string; type?: string } }> = [];
    const cotToken = JSON.stringify({
      message: '## OBJECTIVE\n\nThe user wants profile.\n\n## CHECKLIST\n\nContext.',
      type: 'order_list',
      data: { orders: [{ id: 'EON999', mixins: { huge: true } }] },
    });
    const streamBody = [
      toNamedSseEvent(
        'tool_result',
        JSON.stringify({
          tool_name: 'get-customer-orders',
          tool_call_id: 'call-1',
          output: { orders: [{ id: 'EON1735', status: 'CREATED', totalPrice: 10, currency: 'EUR' }] },
        }),
      ),
      toContentToken(cotToken),
    ].join('');

    const assembled = await assembleEmporixChatStream(streamBody, (progress) => {
      progressUpdates.push(progress);
    });

    expect(
      progressUpdates.some(
        (update) =>
          update.preview?.kind === 'widget' && update.preview.type === 'order_list' && update.preview.message === '',
      ),
    ).toBe(true);
    const parsed = JSON.parse(assembled.message);
    expect(parsed.data.orders[0].orderId).toBe('EON1735');
  });

  it('forwards thinking on progress and omits it from the complete message', async () => {
    const progressUpdates: Array<{ thinking?: string }> = [];
    const streamBody = [
      toNamedSseEvent('thinking', JSON.stringify({ content: 'I will look up quotes.' })),
      toContentToken('Here they are.'),
    ].join('');

    const assembled = await assembleEmporixChatStream(streamBody, (progress) => {
      progressUpdates.push(progress);
    });

    expect(progressUpdates.some((update) => update.thinking === 'active')).toBe(true);
    expect(assembled.message).toBe('Here they are.');
    expect(assembled.message).not.toContain('I will look up quotes.');
  });

  it('sanitizes planning markdown from plain-text completion', async () => {
    const planning = '## OBJECTIVE\n\nGoal.\n\n## CHECKLIST\n\nSteps.';
    await expect(assembleEmporixChatStream(toContentToken(planning))).rejects.toThrow(
      'AI stream contained an empty message',
    );
  });

  it('rejects planning-only text JSON envelopes after sanitization', async () => {
    const envelope = JSON.stringify({
      message: '## SESSION INTENT\n\nThe user wants to add a product.',
      type: 'text',
    });
    await expect(assembleEmporixChatStream(toContentToken(envelope))).rejects.toThrow(
      'AI stream contained an empty message',
    );
  });

  it('does not preview incomplete planning heading prefixes while adding to cart', async () => {
    const progressUpdates: Array<{ preview?: { kind: string; content?: string } }> = [];
    const streamBody = [
      toContentToken('##'),
      toContentToken(' SESSION INTENT\n\nThe user wants to add a product.'),
      toNamedSseEvent(
        'tool_result',
        JSON.stringify({
          tool_name: 'get-cart',
          tool_call_id: 'call-1',
          output: { items: [{ id: 'P1', quantity: 1 }] },
        }),
      ),
    ].join('');

    await assembleEmporixChatStream(streamBody, (progress) => {
      progressUpdates.push(progress);
    });

    expect(
      progressUpdates.some((update) => update.preview?.kind === 'text' && update.preview.content?.includes('#')),
    ).toBe(false);
  });

  it('keeps widget envelopes with empty caption when tool data is present', async () => {
    const streamBody = [
      toNamedSseEvent(
        'tool_result',
        JSON.stringify({
          tool_name: 'get-customer-orders',
          tool_call_id: 'call-1',
          output: { orders: [{ id: 'EON1', status: 'CREATED' }] },
        }),
      ),
      toContentToken('## SESSION INTENT\n\nLook up orders.'),
    ].join('');

    const assembled = await assembleEmporixChatStream(streamBody);
    const parsed = parseAIResponse(assembled.message);
    expect(parsed.type).toBe('order_list');
    expect(parsed.message).toBe('');
    expect(parsed.data).toMatchObject({ orders: [{ orderId: 'EON1' }] });
  });

  it('fills product_list from indexedProducts tool_result before final tokens', async () => {
    const progressUpdates: AIChatStreamProgressUpdate[] = [];
    const streamBody = [
      toNamedSseEvent(
        'tool_start',
        JSON.stringify({ tool_name: 'search_showcasedev__indexedProducts', tool_call_id: 'call-1' }),
      ),
      toNamedSseEvent(
        'tool_result',
        JSON.stringify({
          tool_name: 'search_showcasedev__indexedProducts',
          tool_call_id: 'call-1',
          output: {
            data: {
              results: [
                {
                  metadata: {
                    code: 'SOLAR-1',
                    name: { en: 'Solar Panel 300W' },
                    medias: [{ url: 'https://cdn.example/solar.jpg' }],
                    sitePrices: { main: { effectiveAmount: 199.5, currency: 'EUR' } },
                  },
                },
              ],
            },
          },
        }),
      ),
      toContentToken('{"message":"Here are similar products.","type":"product_list","data":{"products":[]}}'),
    ].join('');

    const assembled = await assembleEmporixChatStream(streamBody, (progress) => {
      progressUpdates.push(progress);
    });

    expect(
      progressUpdates.some((update) => {
        if (update.preview?.kind !== 'widget' || update.preview.type !== 'product_list') return false;
        const products = widgetData<ProductListWidgetData>(update)?.products;
        return Array.isArray(products) && products.length === 1;
      }),
    ).toBe(true);

    const parsed = JSON.parse(assembled.message);
    expect(parsed.type).toBe('product_list');
    expect(parsed.data.products).toEqual([
      {
        productId: 'SOLAR-1',
        name: 'Solar Panel 300W',
        image: 'https://cdn.example/solar.jpg',
        price: 199.5,
        currency: 'EUR',
      },
    ]);
  });
});
