import {
  previewStreamingAIMessage,
  sanitizeCompletedShopperText,
  sanitizeShopperCaption,
  toStreamProgressUpdate,
  widgetTypeFromToolName,
} from './ai-stream-preview';

describe('previewStreamingAIMessage', () => {
  it('returns plain text for non-JSON token buffers', () => {
    expect(previewStreamingAIMessage('Hello, world!')).toEqual({
      kind: 'text',
      content: 'Hello, world!',
    });
  });

  it('streams a widget skeleton from an incomplete order_list envelope', () => {
    const partial = '{"message":"Here are your orders","type":"order_list","data":{"orders":[';
    expect(previewStreamingAIMessage(partial)).toEqual({
      kind: 'widget',
      type: 'order_list',
      message: 'Here are your orders',
      data: {},
    });
  });

  it('streams a widget skeleton from a live frontendAgent order_list envelope', () => {
    const live =
      '{"agentId":"frontendAgent","sessionId":"e05b0cc6","message":"Here are all your orders.","type":"order_list","data":{"orders":[';
    expect(previewStreamingAIMessage(live)).toEqual({
      kind: 'widget',
      type: 'order_list',
      message: 'Here are all your orders.',
      data: {},
    });
  });

  it('streams a widget skeleton without caption before the message string closes', () => {
    const live = '{"type":"order_list","message":"Here are all';
    expect(previewStreamingAIMessage(live)).toEqual({
      kind: 'widget',
      type: 'order_list',
      message: '',
      data: {},
    });
  });

  it('stays pending before the message string closes when no widget type is known yet', () => {
    const live = '{"agentId":"frontendAgent","sessionId":"e05b0cc6","message":"Here are all';
    expect(previewStreamingAIMessage(live)).toEqual({ kind: 'pending' });
  });

  it('drops multi-section planning markdown from widget captions', () => {
    const partial =
      '{"message":"## OBJECTIVE\\n\\nThe user wants profile.\\n\\n## CHECKLIST\\n\\nContext.","type":"order_list","data":{"orders":[{"orderId":"EON1"}]}}';
    expect(previewStreamingAIMessage(partial)).toEqual({
      kind: 'widget',
      type: 'order_list',
      message: '',
      data: { orders: [{ orderId: 'EON1' }] },
    });
  });

  it('drops a short single planning heading from captions', () => {
    expect(sanitizeShopperCaption('## OBJECTIVE\nLook up orders.')).toBe('');
    expect(sanitizeCompletedShopperText('## OBJECTIVE\nLook up orders.')).toBe('');
  });

  it('keeps long completed shopper answers while still capping live captions', () => {
    const longAnswer = `Thanks for waiting. ${'Details about your order history. '.repeat(40)}`;
    expect(longAnswer.length).toBeGreaterThan(512);
    expect(sanitizeShopperCaption(longAnswer)).toBe('');
    expect(sanitizeCompletedShopperText(longAnswer)).toBe(longAnswer);
  });

  it('keeps order_list preview when nested html description fields appear', () => {
    const partial =
      '{"type":"order_list","message":"Orders","data":{"orders":[{"orderId":"EON1","description":{"html":"<p>hi"}}';
    expect(previewStreamingAIMessage(partial)).toEqual({
      kind: 'widget',
      type: 'order_list',
      message: 'Orders',
      data: {},
    });
  });

  it('drops captions with glued JSON envelope fragments', () => {
    const partial =
      '{"message":"Display profile context.{\\n  \\"agent\\",\\"data\\":{\\"orders\\":[{\\"orderId\\":\\"EON1\\"}]}}","type":"order_list","data":{"orders":[{"orderId":"EON1"}]}}';
    expect(previewStreamingAIMessage(partial)).toEqual({
      kind: 'widget',
      type: 'order_list',
      message: '',
      data: { orders: [{ orderId: 'EON1' }] },
    });
  });

  it('paints account_details as soon as the envelope JSON is complete', () => {
    const envelope = JSON.stringify({
      message: 'Here is your account information.',
      type: 'account_details',
      data: { personalInfo: { name: 'Ada Lovelace', email: 'ada@example.com' } },
    });
    expect(previewStreamingAIMessage(envelope)).toEqual({
      kind: 'widget',
      type: 'account_details',
      message: 'Here is your account information.',
      data: { personalInfo: { name: 'Ada Lovelace', email: 'ada@example.com' } },
    });
  });

  it('paints widget data once the nested data object closes', () => {
    const partial =
      '{"message":"Here is your account information.","type":"account_details","data":{"personalInfo":{"name":"Ada"}}}';
    expect(previewStreamingAIMessage(partial)).toEqual({
      kind: 'widget',
      type: 'account_details',
      message: 'Here is your account information.',
      data: { personalInfo: { name: 'Ada' } },
    });
  });

  it('returns growing html preview from partial envelopes', () => {
    const partial = '{"type":"html","data":{"html":"<p>Hello';
    expect(previewStreamingAIMessage(partial)).toEqual({
      kind: 'html',
      html: '<p>Hello',
    });
  });

  it('returns text preview from complete text envelopes', () => {
    const envelope = JSON.stringify({
      message: 'Intro',
      type: 'text',
      data: { message: 'Body line', formatting: 'plain' },
    });
    expect(previewStreamingAIMessage(envelope)).toEqual({
      kind: 'text',
      content: 'Intro\nBody line',
    });
  });

  it('returns html preview from complete html envelopes', () => {
    const envelope = JSON.stringify({
      type: 'html',
      data: { html: '<p>Done</p>' },
    });
    expect(previewStreamingAIMessage(envelope)).toEqual({
      kind: 'html',
      html: '<p>Done</p>',
    });
  });

  it('ignores leading tool fences and previews the trailing html envelope', () => {
    const toolFence = '```json\n{"query":"orders","filter":"NO_FILTER"}\n```\n';
    const partialEnvelope = '{"type":"html","data":{"html":"<p>Hello';
    expect(previewStreamingAIMessage(`${toolFence}${partialEnvelope}`)).toEqual({
      kind: 'html',
      html: '<p>Hello',
    });
  });

  it('previews html nested inside a published ChatResponse message string', () => {
    const partialOuter = JSON.stringify({
      agentId: 'frontendAgent',
      sessionId: 'session-1',
      message: '{"type":"html","data":{"html":"<p>Streaming',
    }).slice(0, -1);
    expect(previewStreamingAIMessage(partialOuter)).toEqual({
      kind: 'html',
      html: '<p>Streaming',
    });
  });

  it('stays pending while inside an incomplete leading tool fence', () => {
    expect(previewStreamingAIMessage('```json\n{"query":"orders"}')).toEqual({ kind: 'pending' });
  });

  it('maps prefixed MCP tool names to widget types', () => {
    expect(widgetTypeFromToolName('showcasedev__get-customer-info')).toBe('account_details');
    expect(widgetTypeFromToolName('search_showcasedev__indexedOrders')).toBe('order_list');
  });
});

describe('sanitizeShopperCaption', () => {
  it('keeps short shopper captions', () => {
    expect(sanitizeShopperCaption('Here are your orders.')).toBe('Here are your orders.');
  });

  it('keeps multi-line text without markdown headings', () => {
    expect(sanitizeShopperCaption('Intro\nBody line')).toBe('Intro\nBody line');
  });

  it('drops multi-section markdown documents', () => {
    expect(sanitizeShopperCaption('## OBJECTIVE\n\nGoal.\n\n## CHECKLIST\n\nSteps.')).toBe('');
  });

  it('drops a single heading with document-shaped length', () => {
    expect(sanitizeShopperCaption(`## NOTES\n\n${'detail '.repeat(60)}`)).toBe('');
  });

  it('drops captions with envelope JSON leaks', () => {
    expect(sanitizeShopperCaption('Context { "agentId": "frontendAgent" }')).toBe('');
    expect(sanitizeShopperCaption('Context { "sessionId": "abc" }')).toBe('');
    expect(sanitizeShopperCaption('Context { "tool_call": "call-1" }')).toBe('');
  });

  it('drops captions longer than the safety cap', () => {
    expect(sanitizeShopperCaption('x'.repeat(513))).toBe('');
  });
});

describe('toStreamProgressUpdate', () => {
  it('omits preview when pending', () => {
    expect(toStreamProgressUpdate(3, { kind: 'pending' })).toEqual({ chunks: 3 });
  });

  it('includes preview for text and html', () => {
    expect(toStreamProgressUpdate(2, { kind: 'text', content: 'Hi' })).toEqual({
      chunks: 2,
      preview: { kind: 'text', content: 'Hi' },
    });
  });

  it('includes thinking even when preview is pending', () => {
    expect(toStreamProgressUpdate(1, { kind: 'pending' }, 'Looking up quotes')).toEqual({
      chunks: 1,
      thinking: 'Looking up quotes',
    });
  });

  it('omits empty text previews so the spinner stays up', () => {
    expect(toStreamProgressUpdate(2, { kind: 'text', content: '' })).toEqual({ chunks: 2 });
  });
});
