import { mapAiQuote } from '@/components/account/dashboard/cards/ai/utils/map-ai-quote';

const TOOL_WIDGET_TYPES: Record<string, string> = {
  'get-customer-orders': 'order_list',
  'get-products': 'product_list',
  'get-product': 'product_list',
  'get-cart': 'cart_summary',
  'get-quotes': 'quote_list',
  'get-quote': 'quote_details',
  'get-returns': 'return_list',
  'get-return': 'return_details',
  'get-companies-addresses': 'address_list',
  'get-customer-addresses': 'address_list',
  'get-customer-info': 'account_details',
};

/** Entity suffix after `indexed` / `indexed-` → storefront widget type. */
const INDEXED_ENTITY_WIDGET_TYPES: Record<string, string> = {
  products: 'product_list',
  product: 'product_list',
  orders: 'order_list',
  order: 'order_list',
};

export type AdaptedWidget = {
  type: string;
  data: Record<string, unknown>;
};

export const canonicalToolName = (toolName: string): string => {
  return toolName.split('__').pop()?.trim().toLowerCase().replaceAll('_', '-') ?? '';
};

export const widgetTypeFromToolName = (toolName: string): string | null => {
  const canonical = canonicalToolName(toolName);
  if (!canonical) {
    return null;
  }
  if (TOOL_WIDGET_TYPES[canonical]) {
    return TOOL_WIDGET_TYPES[canonical];
  }
  const indexedWidget = widgetTypeFromIndexedTool(canonical);
  if (indexedWidget) {
    return indexedWidget;
  }
  for (const [key, type] of Object.entries(TOOL_WIDGET_TYPES)) {
    if (canonical.endsWith(key)) {
      return type;
    }
  }
  return null;
};

function widgetTypeFromIndexedTool(canonical: string): string | null {
  if (!canonical.startsWith('indexed')) {
    return null;
  }
  const entity = canonical.slice('indexed'.length).replace(/^-/, '');
  if (!entity) {
    return null;
  }
  return INDEXED_ENTITY_WIDGET_TYPES[entity] ?? null;
}

export const widgetHasItems = (data: Record<string, unknown>): boolean => {
  return Object.entries(data).some(([key, value]) => isMeaningfulWidgetValue(key, value));
};

export const adaptToolResult = (toolName: string, output: unknown): AdaptedWidget | null => {
  const type = widgetTypeFromToolName(toolName);
  if (!type) {
    return null;
  }
  const payload = unwrapPayload(output);
  if (payload == null) {
    return null;
  }

  switch (type) {
    case 'quote_list':
      return {
        type,
        data: {
          quotes: extractList(payload, 'quotes').map((quote) => mapAiQuote(quote)),
          pagination: extractPagination(payload),
        },
      };
    case 'quote_details':
      return { type, data: asWidgetData(mapAiQuote(extractSingleton(payload, 'quotes'))) };
    case 'order_list':
      return {
        type,
        data: {
          orders: extractWidgetItems(payload, toolName, 'orders').map(adaptOrder),
          pagination: extractPagination(payload),
        },
      };
    case 'product_list':
      return { type, data: { products: extractWidgetItems(payload, toolName, 'products').map(adaptProduct) } };
    case 'return_list':
      return { type, data: { returns: extractList(payload, 'returns') } };
    case 'return_details': {
      const item = extractSingleton(payload, 'returns');
      return { type, data: { return: isRecord(item) ? item : undefined } };
    }
    case 'address_list':
      return { type, data: { addresses: extractList(payload, 'addresses') } };
    case 'cart_summary':
      return { type, data: { items: extractList(payload, 'items') } };
    case 'account_details':
      return { type, data: adaptAccount(payload, toolName) };
  }
  return null;
};

function asWidgetData(value: object): Record<string, unknown> {
  return value as unknown as Record<string, unknown>;
}

const TOOL_ENVELOPE_PAYLOAD_KEYS = ['content', 'output', 'result'] as const;
const TOOL_ENVELOPE_META_KEYS = new Set([
  'name',
  'type',
  'tool_call_id',
  'toolCallId',
  'tool_name',
  'status',
  'role',
  'id',
  'additional_kwargs',
  'response_metadata',
  'artifact',
  'isError',
  'is_error',
]);

function unwrapPayload(output: unknown, depth = 0): unknown {
  if (depth > 8) {
    return isRecord(output) || Array.isArray(output) ? output : null;
  }
  if (typeof output === 'string') {
    const trimmed = output.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return unwrapPayload(JSON.parse(trimmed) as unknown, depth + 1);
      } catch {
        return null;
      }
    }
    return null;
  }
  if (Array.isArray(output)) {
    return output;
  }
  if (!isRecord(output)) {
    return null;
  }

  const structured = structuredContentFrom(output);
  if (structured != null) {
    const unwrapped = unwrapPayload(structured, depth + 1);
    if (unwrapped != null) {
      return unwrapped;
    }
  }

  if (!looksLikeToolEnvelope(output)) {
    return output;
  }

  for (const key of TOOL_ENVELOPE_PAYLOAD_KEYS) {
    if (output[key] == null) {
      continue;
    }
    const unwrapped = unwrapPayload(output[key], depth + 1);
    if (unwrapped != null) {
      return unwrapped;
    }
  }

  return stripEnvelopeMeta(output);
}

function structuredContentFrom(record: Record<string, unknown>): unknown {
  if (record.structuredContent != null) {
    return record.structuredContent;
  }
  if (record.structured_content != null) {
    return record.structured_content;
  }
  if (!isRecord(record.artifact)) {
    return null;
  }
  const artifact = record.artifact;
  if (artifact.structured_content != null) {
    return artifact.structured_content;
  }
  if (artifact.structuredContent != null) {
    return artifact.structuredContent;
  }
  return null;
}

function looksLikeToolEnvelope(record: Record<string, unknown>): boolean {
  if (readString(record.type) === 'tool') {
    return true;
  }
  const name = readString(record.name) ?? readString(record.tool_name);
  if (!name) {
    return false;
  }
  if (record.tool_call_id != null || record.toolCallId != null) {
    return true;
  }
  return widgetTypeFromToolName(name) != null;
}

function stripEnvelopeMeta(record: Record<string, unknown>): Record<string, unknown> | null {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (TOOL_ENVELOPE_META_KEYS.has(key) || value == null || value === '') {
      continue;
    }
    rest[key] = value;
  }
  return Object.keys(rest).length > 0 ? rest : null;
}

function isMeaningfulWidgetValue(key: string, value: unknown): boolean {
  if (key === 'pagination') {
    return false;
  }
  if (value == null || value === '') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (isRecord(value)) {
    return Object.entries(value).some(([nestedKey, nested]) => isMeaningfulWidgetValue(nestedKey, nested));
  }
  return true;
}

function extractList(payload: unknown, key: string): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!isRecord(payload)) {
    return [];
  }
  const direct = payload[key];
  if (Array.isArray(direct)) {
    return direct;
  }
  for (const nestedKey of ['content', 'data', key]) {
    const nested = payload[nestedKey];
    if (Array.isArray(nested)) {
      return nested;
    }
    if (isRecord(nested) && Array.isArray(nested[key])) {
      return nested[key] as unknown[];
    }
  }
  return [];
}

function isIndexedToolName(toolName: string): boolean {
  return canonicalToolName(toolName).startsWith('indexed');
}

function extractIndexedResults(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!isRecord(payload)) {
    return [];
  }
  if (Array.isArray(payload.results)) {
    return payload.results;
  }
  if (isRecord(payload.data) && Array.isArray(payload.data.results)) {
    return payload.data.results;
  }
  if (isRecord(payload.content) && Array.isArray(payload.content.results)) {
    return payload.content.results;
  }
  return [];
}

function indexedHitRecord(item: unknown): unknown {
  if (!isRecord(item)) {
    return item;
  }
  return isRecord(item.metadata) ? item.metadata : item;
}

function extractWidgetItems(payload: unknown, toolName: string, listKey: string): unknown[] {
  if (isIndexedToolName(toolName)) {
    const results = extractIndexedResults(payload);
    if (results.length > 0) {
      return results.map(indexedHitRecord);
    }
  }
  return extractList(payload, listKey);
}

function extractSingleton(payload: unknown, listKey: string): unknown {
  if (Array.isArray(payload)) {
    return payload[0];
  }
  const list = extractList(payload, listKey);
  if (list.length === 1) {
    return list[0];
  }
  return isRecord(payload) ? payload : null;
}

function extractPagination(payload: unknown): Record<string, unknown> | undefined {
  if (!isRecord(payload) || !isRecord(payload.pagination)) {
    return undefined;
  }
  return payload.pagination;
}

function adaptOrder(item: unknown): Record<string, unknown> {
  const record = isRecord(item) ? item : {};
  const metadata = isRecord(record.metadata) ? record.metadata : {};
  const orderId = readString(record.orderId) ?? readString(record.id) ?? '';
  const statusValue = isRecord(record.status) ? readString(record.status.value) : readString(record.status);
  const items = adaptOrderItems(record);
  const entryCount = Array.isArray(record.entries) ? record.entries.length : undefined;
  const itemCount =
    items.length > 0 ? items.length : (readNumber(record.itemCount) ?? readNumber(record.totalItems) ?? entryCount);

  return {
    orderId,
    status: statusValue ?? '',
    date:
      readString(record.date) ??
      readString(record.created) ??
      readString(record.createdAt) ??
      readString(metadata.createdAt) ??
      '',
    siteCode: readString(record.siteCode) ?? readString(record.site),
    currency: readString(record.currency),
    total: adaptOrderTotal(record),
    itemCount,
    totalItems: itemCount,
    items: items.length > 0 ? items : undefined,
  };
}

function adaptOrderTotal(record: Record<string, unknown>): Record<string, unknown> | undefined {
  if (isRecord(record.total)) {
    return record.total;
  }
  const calculated = isRecord(record.calculatedPrice) ? record.calculatedPrice : null;
  const finalPrice = calculated && isRecord(calculated.finalPrice) ? calculated.finalPrice : null;
  const gross = readNumber(record.totalPrice) ?? readNumber(finalPrice?.grossValue) ?? readNumber(record.subTotalPrice);
  const net = readNumber(finalPrice?.netValue);
  const tax = readNumber(finalPrice?.taxValue);
  if (gross == null && net == null) {
    return undefined;
  }
  return {
    gross: gross ?? net,
    value: gross ?? net,
    ...(net != null ? { net } : {}),
    ...(tax != null ? { tax } : {}),
  };
}

function adaptOrderItems(record: Record<string, unknown>): Array<Record<string, unknown>> {
  const sources = Array.isArray(record.items) ? record.items : Array.isArray(record.entries) ? record.entries : [];
  const mapped: Array<Record<string, unknown>> = [];
  for (const source of sources) {
    const item = adaptOrderItem(source);
    if (item) {
      mapped.push(item);
    }
  }
  return mapped;
}

function adaptOrderItem(item: unknown): Record<string, unknown> | null {
  if (!isRecord(item)) {
    return null;
  }
  const product = isRecord(item.product) ? item.product : null;
  const media = product && isRecord(product.media) ? product.media : isRecord(item.media) ? item.media : null;
  const name =
    readString(item.name) ??
    localizedName(item.name) ??
    (product ? (readString(product.name) ?? localizedName(product.name)) : undefined);
  const productId =
    readString(item.productId) ?? (product ? (readString(product.id) ?? readString(product.productId)) : undefined);
  if (!name && !productId) {
    return null;
  }
  const mapped: Record<string, unknown> = {
    name: name ?? productId,
    quantity:
      readNumber(item.quantity) ??
      readNumber(item.amount) ??
      readNumber(item.orderedAmount) ??
      readNumber(item.effectiveQuantity) ??
      1,
  };
  if (productId) {
    mapped.productId = productId;
  }
  const image = readString(item.image) ?? (media ? readString(media.url) : undefined);
  if (image) {
    mapped.image = image;
  }
  const unitPrice = adaptPriceField(item.unitPrice ?? item.calculatedUnitPrice);
  if (unitPrice) {
    mapped.unitPrice = unitPrice;
  }
  const totalPrice = adaptPriceField(item.totalPrice ?? item.price);
  if (totalPrice) {
    mapped.totalPrice = totalPrice;
  }
  return mapped;
}

function adaptPriceField(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value)) {
    return value;
  }
  const amount = readNumber(value);
  if (amount == null) {
    return undefined;
  }
  return { gross: amount, value: amount };
}

export const toDisplayString = (value: unknown): string | undefined => {
  return readString(value) ?? localizedName(value);
};

function adaptProductImage(record: Record<string, unknown>): string | undefined {
  const direct = readString(record.image);
  if (direct) {
    return direct;
  }
  const media = record.media;
  if (isRecord(media)) {
    return readString(media.url);
  }
  if (Array.isArray(media) && media.length > 0 && isRecord(media[0])) {
    return readString(media[0].url);
  }
  const medias = record.medias;
  if (Array.isArray(medias) && medias.length > 0 && isRecord(medias[0])) {
    return readString(medias[0].url);
  }
  const primaryImage = record.primaryImage;
  if (isRecord(primaryImage)) {
    return readString(primaryImage.url);
  }
  return undefined;
}

function adaptProductPriceFields(record: Record<string, unknown>): { price?: number; currency?: string } {
  const priceValue = record.price;
  const currency = readString(record.currency);
  if (typeof priceValue === 'number') {
    return { price: priceValue, currency };
  }
  if (typeof priceValue === 'string') {
    const parsed = Number.parseFloat(priceValue);
    return Number.isFinite(parsed) ? { price: parsed, currency } : currency ? { currency } : {};
  }
  if (isRecord(priceValue)) {
    const amount =
      readNumber(priceValue.amount) ??
      readNumber(priceValue.gross) ??
      readNumber(priceValue.value) ??
      readNumber(priceValue.netValue);
    const priceCurrency = readString(priceValue.currency) ?? currency;
    if (amount != null) {
      return { price: amount, currency: priceCurrency };
    }
  }
  const sitePrices = record.sitePrices;
  if (isRecord(sitePrices)) {
    for (const sitePrice of Object.values(sitePrices)) {
      if (!isRecord(sitePrice)) {
        continue;
      }
      const amount = readNumber(sitePrice.effectiveAmount) ?? readNumber(sitePrice.amount);
      const siteCurrency = readString(sitePrice.currency) ?? currency;
      if (amount != null) {
        return { price: amount, currency: siteCurrency };
      }
    }
  }
  return currency ? { currency } : {};
}

function adaptProduct(item: unknown): Record<string, unknown> {
  const record = isRecord(item) ? item : {};
  const productId =
    readString(record.productId) ?? readString(record.code) ?? readString(record.id) ?? readString(record._id) ?? '';
  const { price, currency } = adaptProductPriceFields(record);
  return compactRecord({
    productId,
    name: toDisplayString(record.name) ?? productId,
    brand: toDisplayString(record.brand),
    description: toDisplayString(record.description),
    image: adaptProductImage(record),
    price,
    currency,
  });
}

function adaptAccount(payload: unknown, toolName: string): Record<string, unknown> {
  const record = isRecord(payload) ? payload : {};
  const nested =
    firstRecord(record, 'customer', 'account', 'profile', 'user', 'data') ??
    (isRecord(record.personalInfo) ? record : record);
  const personal = isRecord(nested.personalInfo) ? nested.personalInfo : nested;
  const first = readString(personal.firstName) ?? '';
  const last = readString(personal.lastName) ?? '';
  const rawName = readString(personal.name);
  const name = isToolLikeName(rawName, toolName) ? `${first} ${last}`.trim() : (rawName ?? `${first} ${last}`.trim());
  const company =
    readString(personal.company) ?? (isRecord(personal.company) ? readString(personal.company.name) : undefined);
  const addresses = Array.isArray(nested.addresses) ? nested.addresses : undefined;
  const personalInfo = compactRecord({
    name,
    email: readString(personal.email) ?? readString(personal.contactEmail) ?? readString(personal.contact_email),
    company,
    customerNumber: readString(personal.customerNumber) ?? readString(personal.customerNo) ?? readString(personal.id),
    businessModel: readString(personal.businessModel),
    preferredLanguage: readString(personal.preferredLanguage),
    preferredCurrency: readString(personal.preferredCurrency),
    preferredSite: readString(personal.preferredSite),
    lastLogin: readString(personal.lastLogin),
  });
  return compactRecord({
    personalInfo: Object.keys(personalInfo).length > 0 ? personalInfo : undefined,
    addresses: addresses && addresses.length > 0 ? addresses : undefined,
  });
}

function isToolLikeName(name: string | undefined, toolName: string): boolean {
  if (!name) {
    return false;
  }
  const canonical = canonicalToolName(name);
  if (canonical && canonical === canonicalToolName(toolName)) {
    return true;
  }
  return widgetTypeFromToolName(name) != null;
}

function compactRecord(record: Record<string, unknown>): Record<string, unknown> {
  const compact: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value == null || value === '') {
      continue;
    }
    compact[key] = value;
  }
  return compact;
}

function firstRecord(record: Record<string, unknown>, ...keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    if (isRecord(record[key])) {
      return record[key] as Record<string, unknown>;
    }
  }
  return null;
}

function localizedName(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return (
    readString(value.en) ??
    readString(value.de) ??
    Object.values(value).find((entry): entry is string => typeof entry === 'string' && entry !== '')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  if (typeof value === 'string' && value !== '') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
