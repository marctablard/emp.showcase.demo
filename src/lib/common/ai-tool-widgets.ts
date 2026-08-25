import { mapAiQuoteItems } from '@/lib/common/ai-quote-items';

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

const canonicalToolName = (toolName: string): string => {
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
          // Keep localized maps until render (QuoteListRenderer + mapAiQuoteList).
          quotes: extractList(payload, 'quotes'),
          pagination: extractPagination(payload),
        },
      };
    case 'quote_details': {
      const quote = extractSingleton(payload, 'quotes');
      return { type, data: adaptQuoteDetails(quote) };
    }
    case 'order_list':
      return {
        type,
        data: {
          orders: extractWidgetItems(payload, toolName, 'orders').map(adaptOrder),
          pagination: extractPagination(payload),
        },
      };
    case 'product_list':
      return { type, data: { products: extractProductItems(payload, toolName).map(adaptProduct) } };
    case 'return_list':
      return { type, data: { returns: extractList(payload, 'returns') } };
    case 'return_details': {
      const item = extractSingleton(payload, 'returns');
      return { type, data: { return: isRecord(item) ? item : undefined } };
    }
    case 'address_list':
      return { type, data: { addresses: adaptAddresses(extractList(payload, 'addresses')) ?? [] } };
    case 'cart_summary':
      return { type, data: adaptCartSummary(payload) };
    case 'account_details':
      return { type, data: adaptAccount(payload, toolName) };
  }
  return null;
};

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

function unwrapJsonString(output: string, depth: number): unknown {
  const trimmed = output.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }
  try {
    return unwrapPayload(JSON.parse(trimmed) as unknown, depth + 1);
  } catch {
    return null;
  }
}

function unwrapToolEnvelope(output: Record<string, unknown>, depth: number): unknown {
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

function unwrapPayload(output: unknown, depth = 0): unknown {
  if (depth > 8) {
    return isRecord(output) || Array.isArray(output) ? output : null;
  }
  if (typeof output === 'string') {
    return unwrapJsonString(output, depth);
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

  return unwrapToolEnvelope(output, depth);
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

export const isResolvedWidgetField = (key: string, value: unknown): boolean => {
  if (key === 'pagination' || key === 'message') {
    return false;
  }
  if (value == null || value === '') {
    return false;
  }
  if (Array.isArray(value)) {
    return true;
  }
  if (isRecord(value)) {
    return Object.entries(value).some(([nestedKey, nested]) => isResolvedWidgetField(nestedKey, nested));
  }
  return true;
};

function isMeaningfulWidgetValue(key: string, value: unknown): boolean {
  return isResolvedWidgetField(key, value);
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

function extractProductItems(payload: unknown, toolName: string): unknown[] {
  const fromList = extractWidgetItems(payload, toolName, 'products');
  if (fromList.length > 0) {
    return fromList;
  }
  if (canonicalToolName(toolName) !== 'get-product') {
    return fromList;
  }
  const wrapped = extractSingleton(payload, 'products');
  if (wrapped != null) {
    return [wrapped];
  }
  if (isRecord(payload) && (payload.id != null || payload.productId != null || payload.name != null)) {
    return [payload];
  }
  return fromList;
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

function adaptQuoteDetails(quote: unknown): Record<string, unknown> {
  if (!isRecord(quote)) {
    return {};
  }
  const items = mapAiQuoteItems(quote.items);
  return {
    ...quote,
    ...(items.length > 0 ? { items } : {}),
  };
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
    const adapted = adaptPriceField(record.total);
    if (adapted) {
      return adapted;
    }
  }
  const calculated = isRecord(record.calculatedPrice) ? record.calculatedPrice : null;
  const finalPrice = calculated && isRecord(calculated.finalPrice) ? calculated.finalPrice : null;
  const gross = readNumber(record.totalPrice) ?? readNumber(finalPrice?.grossValue) ?? readNumber(record.subTotalPrice);
  const net = readNumber(finalPrice?.netValue);
  const tax = readNumber(finalPrice?.taxValue);
  if (gross == null && net == null) {
    return undefined;
  }
  const total: Record<string, unknown> = {
    gross: gross ?? net,
    value: gross ?? net,
  };
  if (net != null) {
    total.net = net;
  }
  if (tax != null) {
    total.tax = tax;
  }
  return total;
}

function adaptCartSubtotal(record: Record<string, unknown>): Record<string, unknown> | undefined {
  const calculated = isRecord(record.calculatedPrice) ? record.calculatedPrice : null;
  const price = calculated && isRecord(calculated.price) ? calculated.price : null;
  return pickRicherPrice(
    adaptPriceField(price),
    isRecord(record.subtotal) ? adaptPriceField(record.subtotal) : undefined,
    adaptPriceField(record.subTotalPrice),
  );
}

function adaptCartTotal(record: Record<string, unknown>): Record<string, unknown> | undefined {
  const calculated = isRecord(record.calculatedPrice) ? record.calculatedPrice : null;
  const finalPrice = calculated && isRecord(calculated.finalPrice) ? calculated.finalPrice : null;
  return pickRicherPrice(
    adaptPriceField(finalPrice),
    isRecord(record.total) ? adaptPriceField(record.total) : undefined,
    adaptPriceField(record.totalPrice),
    adaptOrderTotal(record),
  );
}

function mapCartItem(source: unknown): Record<string, unknown> | null {
  if (!isRecord(source)) {
    return null;
  }
  return adaptOrderItem(source) ?? source;
}

function adaptCartItems(payload: unknown): Array<Record<string, unknown>> {
  return extractList(payload, 'items')
    .map(mapCartItem)
    .filter((item): item is Record<string, unknown> => item != null);
}

function adaptCartSummary(payload: unknown): Record<string, unknown> {
  const record = isRecord(payload) ? payload : {};
  const nestedCart = firstRecord(record, 'cart', 'data', 'content') ?? record;
  const source =
    isRecord(nestedCart) && (nestedCart.items != null || nestedCart.calculatedPrice != null) ? nestedCart : record;
  const items = adaptCartItems(source.items == null ? payload : source);
  let shops: unknown;
  if (Array.isArray(source.shops)) {
    shops = source.shops;
  } else if (Array.isArray(record.shops)) {
    shops = record.shops;
  }
  return compactRecord({
    items: items.length > 0 ? items : undefined,
    total: adaptCartTotal(source) ?? adaptCartTotal(record),
    subtotal: adaptCartSubtotal(source) ?? adaptCartSubtotal(record),
    currency: readString(source.currency) ?? readString(record.currency),
    siteCode:
      readString(source.siteCode) ?? readString(source.site) ?? readString(record.siteCode) ?? readString(record.site),
    shops,
  });
}

function orderItemSources(record: Record<string, unknown>): unknown[] {
  if (Array.isArray(record.items)) {
    return record.items;
  }
  if (Array.isArray(record.entries)) {
    return record.entries;
  }
  return [];
}

function adaptOrderItems(record: Record<string, unknown>): Array<Record<string, unknown>> {
  const mapped: Array<Record<string, unknown>> = [];
  for (const source of orderItemSources(record)) {
    const item = adaptOrderItem(source);
    if (item) {
      mapped.push(item);
    }
  }
  return mapped;
}

function orderItemMedia(
  product: Record<string, unknown> | null,
  item: Record<string, unknown>,
): Record<string, unknown> | null {
  if (product && isRecord(product.media)) {
    return product.media;
  }
  if (isRecord(item.media)) {
    return item.media;
  }
  return null;
}

function firstImageUrl(images: unknown[]): string | undefined {
  for (const image of images) {
    if (typeof image === 'string' && image !== '') {
      return image;
    }
    if (isRecord(image)) {
      const url = readString(image.url);
      if (url) {
        return url;
      }
    }
  }
  return undefined;
}

function orderItemImage(
  product: Record<string, unknown> | null,
  item: Record<string, unknown>,
  media: Record<string, unknown> | null,
): string | undefined {
  const direct = readString(item.image);
  if (direct) {
    return direct;
  }
  const mediaUrl = media ? readString(media.url) : undefined;
  if (mediaUrl) {
    return mediaUrl;
  }
  if (product && Array.isArray(product.images)) {
    return firstImageUrl(product.images);
  }
  return undefined;
}

function adaptPriceField(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value)) {
    const amount =
      readNumber(value.effectiveAmount) ??
      readNumber(value.amount) ??
      readNumber(value.value) ??
      readNumber(value.gross) ??
      readNumber(value.grossValue);
    const net = readNumber(value.net) ?? readNumber(value.netValue);
    const tax = readNumber(value.tax) ?? readNumber(value.taxValue);
    const currency = readString(value.currency);
    if (amount == null && net == null) {
      return undefined;
    }
    return compactRecord({
      value: amount ?? net,
      gross: amount ?? net,
      net,
      tax,
      currency,
    });
  }
  const amount = readNumber(value);
  if (amount == null) {
    return undefined;
  }
  return { gross: amount, value: amount };
}

function priceBreakdownScore(price: Record<string, unknown>): number {
  const gross = readNumber(price.gross) ?? readNumber(price.value);
  const net = readNumber(price.net);
  const tax = readNumber(price.tax);
  return (gross == null ? 0 : 1) + (net == null ? 0 : 2) + (tax == null ? 0 : 2);
}

function pickRicherPrice(
  ...candidates: Array<Record<string, unknown> | undefined>
): Record<string, unknown> | undefined {
  let best: Record<string, unknown> | undefined;
  let bestScore = 0;
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const score = priceBreakdownScore(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function unitPriceFromEffective(
  effective: number,
  quantity: number,
  grossTotal: number | undefined,
  netTotal: number | undefined,
  currency: string | undefined,
): Record<string, unknown> {
  return compactRecord({
    value: effective,
    gross: quantity > 0 && grossTotal != null ? grossTotal / quantity : effective,
    net: quantity > 0 && netTotal != null ? netTotal / quantity : undefined,
    currency,
  });
}

function totalPriceFromCalculated(
  quantity: number,
  effective: number | undefined,
  grossTotal: number | undefined,
  netTotal: number | undefined,
  taxTotal: number | undefined,
  currency: string | undefined,
): Record<string, unknown> | undefined {
  if (grossTotal != null || netTotal != null) {
    return compactRecord({
      value: grossTotal ?? netTotal,
      gross: grossTotal ?? netTotal,
      net: netTotal,
      tax: taxTotal,
      currency,
    });
  }
  if (effective == null) {
    return undefined;
  }
  return compactRecord({
    value: effective * quantity,
    gross: effective * quantity,
    currency,
  });
}

function scalePriceByQuantity(price: Record<string, unknown>, quantity: number): Record<string, unknown> {
  const scale = (value: unknown): number | undefined => {
    const amount = typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    return amount == null ? undefined : amount * quantity;
  };
  return compactRecord({
    value: scale(price.value),
    gross: scale(price.gross),
    net: scale(price.net),
    tax: scale(price.tax),
    currency: typeof price.currency === 'string' ? price.currency : undefined,
  });
}

function fallbackUnitAmount(effective: number | undefined, quantity: number, grossTotal: number | undefined): number {
  if (effective == null) {
    if (quantity <= 0 || grossTotal == null) {
      return 0;
    }
    return grossTotal / quantity;
  }
  return effective;
}

function adaptOrderLinePrices(
  item: Record<string, unknown>,
  quantity: number,
): { unitPrice?: Record<string, unknown>; totalPrice?: Record<string, unknown> } {
  const explicitUnit = adaptPriceField(item.unitPrice ?? item.calculatedUnitPrice);
  const explicitTotal = adaptPriceField(item.totalPrice);
  const price = isRecord(item.price) ? item.price : null;
  const calculated = isRecord(item.calculatedPrice) ? item.calculatedPrice : null;
  const finalPrice = calculated && isRecord(calculated.finalPrice) ? calculated.finalPrice : null;
  const itemTax = isRecord(item.tax) ? item.tax : null;
  const currency = price ? readString(price.currency) : undefined;
  const effective = price ? readNumber(price.effectiveAmount) : undefined;
  const grossTotal =
    readNumber(finalPrice?.grossValue) ?? readNumber(itemTax?.grossValue) ?? readNumber(finalPrice?.gross);
  const netTotal = readNumber(finalPrice?.netValue) ?? readNumber(itemTax?.netValue) ?? readNumber(finalPrice?.net);
  const taxTotal = readNumber(finalPrice?.taxValue) ?? readNumber(finalPrice?.tax);
  const calculatedTotal = totalPriceFromCalculated(quantity, effective, grossTotal, netTotal, taxTotal, currency);
  const unitAmount = fallbackUnitAmount(effective, quantity, grossTotal);
  const calculatedUnit =
    effective == null && grossTotal == null && netTotal == null
      ? undefined
      : unitPriceFromEffective(unitAmount, quantity, grossTotal, netTotal, currency);

  if (explicitUnit || explicitTotal) {
    return {
      unitPrice: pickRicherPrice(explicitUnit, calculatedUnit),
      totalPrice: pickRicherPrice(
        explicitTotal,
        calculatedTotal,
        explicitUnit ? scalePriceByQuantity(explicitUnit, quantity) : undefined,
      ),
    };
  }

  return {
    unitPrice: calculatedUnit,
    totalPrice: calculatedTotal,
  };
}

function adaptOrderItem(item: unknown): Record<string, unknown> | null {
  if (!isRecord(item)) {
    return null;
  }
  const product = isRecord(item.product) ? item.product : null;
  const media = orderItemMedia(product, item);
  const name =
    readString(item.name) ??
    localizedName(item.name) ??
    (product ? (readString(product.name) ?? localizedName(product.name)) : undefined);
  const productId =
    readString(item.productId) ?? (product ? (readString(product.id) ?? readString(product.productId)) : undefined);
  if (!name && !productId) {
    return null;
  }
  const quantity =
    readNumber(item.quantity) ??
    readNumber(item.amount) ??
    readNumber(item.orderedAmount) ??
    readNumber(item.effectiveQuantity) ??
    1;
  const mapped: Record<string, unknown> = {
    name: name ?? productId,
    quantity,
  };
  if (productId) {
    mapped.productId = productId;
  }
  const image = orderItemImage(product, item, media);
  if (image) {
    mapped.image = image;
  }
  const { unitPrice, totalPrice } = adaptOrderLinePrices(item, quantity);
  if (unitPrice) {
    mapped.unitPrice = unitPrice;
  }
  if (totalPrice) {
    mapped.totalPrice = totalPrice;
  }
  return mapped;
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

function priceFromStringValue(priceValue: string, currency: string | undefined): { price?: number; currency?: string } {
  const parsed = Number.parseFloat(priceValue);
  if (Number.isFinite(parsed)) {
    return { price: parsed, currency };
  }
  if (currency) {
    return { currency };
  }
  return {};
}

function priceFromRecordValue(
  priceValue: Record<string, unknown>,
  currency: string | undefined,
): { price?: number; currency?: string } | null {
  const amount =
    readNumber(priceValue.amount) ??
    readNumber(priceValue.gross) ??
    readNumber(priceValue.value) ??
    readNumber(priceValue.netValue);
  const priceCurrency = readString(priceValue.currency) ?? currency;
  if (amount != null) {
    return { price: amount, currency: priceCurrency };
  }
  return null;
}

function priceFromSitePrices(
  sitePrices: Record<string, unknown>,
  currency: string | undefined,
): { price?: number; currency?: string } | null {
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
  return null;
}

function adaptProductPriceFields(record: Record<string, unknown>): { price?: number; currency?: string } {
  const priceValue = record.price;
  const currency = readString(record.currency);
  if (typeof priceValue === 'number') {
    return { price: priceValue, currency };
  }
  if (typeof priceValue === 'string') {
    return priceFromStringValue(priceValue, currency);
  }
  if (isRecord(priceValue)) {
    const fromRecord = priceFromRecordValue(priceValue, currency);
    if (fromRecord) {
      return fromRecord;
    }
  }
  if (isRecord(record.sitePrices)) {
    const fromSite = priceFromSitePrices(record.sitePrices, currency);
    if (fromSite) {
      return fromSite;
    }
  }
  if (currency) {
    return { currency };
  }
  return {};
}

function adaptProduct(item: unknown): Record<string, unknown> {
  const record = isRecord(item) ? item : {};
  const productId = readString(record.id) ?? readString(record.productId) ?? readString(record.code) ?? '';
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

function joinAddressParts(...parts: Array<string | undefined>): string | undefined {
  const joined = parts
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .trim();
  return joined === '' ? undefined : joined;
}

function stringTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const tags = value.filter((tag): tag is string => typeof tag === 'string' && tag !== '');
  return tags.length > 0 ? tags : undefined;
}

function adaptAddress(item: unknown): Record<string, unknown> | null {
  const record = isRecord(item) ? item : {};
  const nested = isRecord(record.address) ? record.address : record;
  const streetLine = joinAddressParts(readString(nested.street), readString(nested.streetNumber));
  const extraLines = joinAddressParts(
    readString(nested.streetAppendix),
    readString(nested.extraLine1),
    readString(nested.extraLine2),
    readString(nested.extraLine3),
    readString(nested.extraLine4),
    streetLine ? readString(nested.addressLine2) : undefined,
  );
  const displayName = readString(nested.contactName) ?? readString(nested.name) ?? readString(record.companyName);
  const displayCompany = readString(nested.companyName) ?? readString(nested.company) ?? readString(record.companyName);
  const mapped = compactRecord({
    name: displayName,
    company: displayCompany && displayCompany !== displayName ? displayCompany : undefined,
    addressLine1: streetLine ?? readString(nested.addressLine1),
    addressLine2: extraLines ?? (streetLine ? undefined : readString(nested.addressLine2)),
    city: readString(nested.city),
    state: readString(nested.state),
    postalCode: readString(nested.zipCode) ?? readString(nested.postalCode) ?? readString(nested.postcode),
    country: readString(nested.country),
    tags: stringTags(nested.tags),
  });
  return Object.keys(mapped).length > 0 ? mapped : null;
}

function adaptAddresses(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  const addresses = value.map(adaptAddress).filter((item): item is Record<string, unknown> => item != null);
  return addresses.length > 0 ? addresses : undefined;
}

function adaptAccount(payload: unknown, toolName: string): Record<string, unknown> {
  const record = isRecord(payload) ? payload : {};
  const nested = firstRecord(record, 'customer', 'account', 'profile', 'user', 'data') ?? record;
  const personal = isRecord(nested.personalInfo) ? nested.personalInfo : nested;
  const first = readString(personal.firstName) ?? '';
  const last = readString(personal.lastName) ?? '';
  const rawName = readString(personal.name);
  const name = isToolLikeName(rawName, toolName) ? `${first} ${last}`.trim() : (rawName ?? `${first} ${last}`.trim());
  const company =
    readString(personal.company) ?? (isRecord(personal.company) ? readString(personal.company.name) : undefined);
  const addresses =
    adaptAddresses(nested.addresses) ??
    adaptAddresses(nested.defaultAddress == null ? undefined : [nested.defaultAddress]);
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
    addresses,
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
    const value = record[key];
    if (isRecord(value)) {
      return value;
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
