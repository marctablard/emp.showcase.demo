/** Catalog ids accepted in a Product Service `id:(…)` clause. */
const CATALOG_PRODUCT_ID = /^[A-Za-z0-9_.:@/+-]+$/;

/** Short prefixes stay on keyword search; a 3-character miss still reaches the product RAG. */
export const MIN_PRODUCT_RAG_QUERY_LENGTH = 3;

/** One agent reply is enough for a search page or suggestion flyout. */
export const MAX_PRODUCT_RAG_IDS = 12;

const MAX_PARSE_DEPTH = 8;

export function shouldTryProductRag(query: string | undefined): boolean {
  return (query?.trim().length ?? 0) >= MIN_PRODUCT_RAG_QUERY_LENGTH;
}

export function isCatalogProductId(value: string): boolean {
  return CATALOG_PRODUCT_ID.test(value);
}

/**
 * Product ids from a frontend-agent reply. The product RAG tool is surfaced as a
 * `product_list` envelope (`products[].productId` or `productIds`) or as indexed
 * hits (`results[].metadata.id`, then `code`). Other ids on the envelope are ignored.
 */
export function productIdsFromAgentMessage(message: string | undefined | null): string[] {
  if (!message?.trim()) {
    return [];
  }

  const ids: string[] = [];
  collectProductIds(parseJson(message) ?? message, ids, 0);
  return uniqueIds(ids).slice(0, MAX_PRODUCT_RAG_IDS);
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(id);
  }
  return unique;
}

function parseJson(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCatalogId(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return isCatalogProductId(trimmed) ? trimmed : undefined;
}

function collectProductIds(value: unknown, ids: string[], depth: number): void {
  if (depth > MAX_PARSE_DEPTH || ids.length >= MAX_PRODUCT_RAG_IDS) {
    return;
  }
  if (typeof value === 'string') {
    const parsed = parseJson(value);
    if (parsed !== undefined) {
      collectProductIds(parsed, ids, depth + 1);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectProductIds(item, ids, depth + 1);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }

  const listed = [
    ...idsFromProductList(value.products),
    ...idsFromStrings(value.productIds),
    ...idsFromIndexedResults(value.results),
  ];
  if (listed.length > 0) {
    ids.push(...listed);
    return;
  }

  if (value.data != null) {
    collectProductIds(value.data, ids, depth + 1);
  }
  if (typeof value.message === 'string') {
    collectProductIds(value.message, ids, depth + 1);
  }
  if (value.output != null) {
    collectProductIds(value.output, ids, depth + 1);
  }
  if (value.result != null) {
    collectProductIds(value.result, ids, depth + 1);
  }
  if (value.content != null) {
    collectProductIds(value.content, ids, depth + 1);
  }

  const direct = catalogIdFromProductRecord(value);
  if (direct && looksLikeProduct(value)) {
    ids.push(direct);
  }
}

function looksLikeProduct(record: Record<string, unknown>): boolean {
  return record.productId != null || record.code != null || record.metadata != null || record.name != null;
}

function catalogIdFromProductRecord(record: Record<string, unknown>): string | undefined {
  const source = isRecord(record.metadata) ? record.metadata : record;
  return readCatalogId(source.productId) ?? readCatalogId(source.id) ?? readCatalogId(source.code);
}

function idsFromProductList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }
    const id = catalogIdFromProductRecord(item);
    return id ? [id] : [];
  });
}

function idsFromStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const id = readCatalogId(item);
    return id ? [id] : [];
  });
}

function idsFromIndexedResults(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }
    const id = catalogIdFromProductRecord(item);
    return id ? [id] : [];
  });
}
