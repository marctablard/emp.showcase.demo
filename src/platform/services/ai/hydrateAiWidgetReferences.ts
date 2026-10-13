import { adaptToolResult, widgetHasItems } from '@/lib/common/ai-tool-widgets';

/**
 * AI Service drops `tool_result` frames whose output is too large (~128 KB), so the agent also
 * names the entities it shows (`data.orderIds`, …). When the stream carried no tool data, the BFF
 * loads those entities with the shopper's own token and adapts them like a tool result.
 */
export type AiWidgetEntityFetchers = {
  order: (id: string) => Promise<unknown>;
  product: (id: string) => Promise<unknown>;
  quote: (id: string) => Promise<unknown>;
  return: (id: string) => Promise<unknown>;
};

type ReferenceSpec = {
  key: string;
  entity: keyof AiWidgetEntityFetchers;
  maxItems: number;
  adapt: (items: unknown[]) => ReturnType<typeof adaptToolResult>;
};

const REFERENCE_SPECS: Record<string, ReferenceSpec> = {
  order_list: {
    key: 'orderIds',
    entity: 'order',
    maxItems: 10,
    adapt: (items) => adaptToolResult('get-customer-orders', { orders: items }),
  },
  product_list: {
    key: 'productIds',
    entity: 'product',
    maxItems: 20,
    adapt: (items) => adaptToolResult('get-products', { products: items }),
  },
  quote_list: {
    key: 'quoteIds',
    entity: 'quote',
    maxItems: 10,
    adapt: (items) => adaptToolResult('get-quotes', { quotes: items }),
  },
  quote_details: {
    key: 'quoteIds',
    entity: 'quote',
    maxItems: 1,
    adapt: (items) => adaptToolResult('get-quote', items[0]),
  },
  return_list: {
    key: 'returnIds',
    entity: 'return',
    maxItems: 10,
    adapt: (items) => adaptToolResult('get-returns', { returns: items }),
  },
};

/** IDs are interpolated into API paths, so only plain identifiers are accepted. */
const ENTITY_ID_PATTERN = /^[\w.:-]{1,64}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function referencedIds(data: Record<string, unknown>, spec: ReferenceSpec): string[] {
  const raw = data[spec.key];
  if (!Array.isArray(raw)) {
    return [];
  }
  const ids = raw.filter((id): id is string => typeof id === 'string' && ENTITY_ID_PATTERN.test(id));
  return [...new Set(ids)].slice(0, spec.maxItems);
}

async function loadEntities(ids: string[], fetch: (id: string) => Promise<unknown>): Promise<unknown[]> {
  const results = await Promise.allSettled(ids.map((id) => fetch(id)));
  return results.flatMap((result) => (result.status === 'fulfilled' && result.value != null ? [result.value] : []));
}

function withoutReferences(envelope: Record<string, unknown>, data: Record<string, unknown>, key: string): string {
  const { [key]: _references, ...rest } = data;
  return JSON.stringify({ ...envelope, data: Object.keys(rest).length > 0 ? rest : null });
}

export async function hydrateAiWidgetReferences(message: string, fetchers: AiWidgetEntityFetchers): Promise<string> {
  let envelope: unknown;
  try {
    envelope = JSON.parse(message);
  } catch {
    return message;
  }
  if (!isRecord(envelope) || typeof envelope.type !== 'string' || !isRecord(envelope.data)) {
    return message;
  }
  const spec = REFERENCE_SPECS[envelope.type];
  if (!spec || widgetHasItems(envelope.data)) {
    return message;
  }

  const ids = referencedIds(envelope.data, spec);
  const entities = ids.length > 0 ? await loadEntities(ids, fetchers[spec.entity]) : [];
  const adapted = entities.length > 0 ? spec.adapt(entities) : null;
  if (!adapted || !widgetHasItems(adapted.data)) {
    return withoutReferences(envelope, envelope.data, spec.key);
  }
  return JSON.stringify({ ...envelope, data: adapted.data });
}
