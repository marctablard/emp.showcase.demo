export type AiQuoteItem = {
  productId?: string;
  name: string;
  image?: string;
  description?: string;
  quantity: number;
  price?: number;
  currency?: string;
  unitPrice?: {
    value?: number;
    gross?: number;
    net?: number;
    tax?: number;
    currency?: string;
  };
  totalPrice?: {
    value?: number;
    gross?: number;
    net?: number;
    tax?: number;
    currency?: string;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function localizedText(value: unknown, locale?: string): string | undefined {
  const direct = readString(value);
  if (direct) {
    return direct;
  }
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }
  if (locale) {
    const localized = readString(record[locale]);
    if (localized) {
      return localized;
    }
  }
  const english = readString(record.en);
  if (english) {
    return english;
  }
  for (const nested of Object.values(record)) {
    const text = readString(nested);
    if (text) {
      return text;
    }
  }
  return undefined;
}

function readQuantity(record: Record<string, unknown>): number {
  const quantityRecord = asRecord(record.quantity);
  return readNumber(quantityRecord?.quantity) ?? readNumber(record.quantity) ?? readNumber(record.amount) ?? 1;
}

function priceFromRecord(value: unknown): AiQuoteItem['unitPrice'] | undefined {
  const record = asRecord(value);
  if (!record) {
    const amount = readNumber(value);
    return amount == null ? undefined : { value: amount, gross: amount };
  }
  const gross =
    readNumber(record.gross) ??
    readNumber(record.grossValue) ??
    readNumber(record.value) ??
    readNumber(record.amount) ??
    readNumber(record.effectiveAmount);
  const net = readNumber(record.net) ?? readNumber(record.netValue);
  const tax = readNumber(record.tax) ?? readNumber(record.taxValue);
  const currency = readString(record.currency);
  if (gross == null && net == null) {
    return undefined;
  }
  return {
    value: gross ?? net,
    gross: gross ?? net,
    net,
    tax,
    currency,
  };
}

function mapOneQuoteItem(item: unknown, locale?: string): AiQuoteItem | null {
  const record = asRecord(item);
  if (!record) {
    return null;
  }
  const product = asRecord(record.product);
  const media = asRecord(product?.media) ?? asRecord(record.media);
  const name = localizedText(product?.name, locale) ?? readString(record.name) ?? localizedText(record.name, locale);
  const productId =
    readString(record.productId) ?? (product ? (readString(product.id) ?? readString(product.productId)) : undefined);
  if (!name && !productId) {
    return null;
  }
  const quantity = readQuantity(record);
  const unitPrice = priceFromRecord(record.unitPrice) ?? priceFromRecord(record.price);
  const totalPrice = priceFromRecord(record.totalPrice) ?? (unitPrice ? scalePrice(unitPrice, quantity) : undefined);
  const currency = readString(record.currency) ?? unitPrice?.currency ?? totalPrice?.currency;

  return {
    productId,
    name: name ?? productId ?? '',
    image: readString(media?.url) ?? readString(record.image),
    description: localizedText(record.description, locale) ?? readString(record.description),
    quantity,
    price: unitPrice?.gross ?? unitPrice?.value,
    currency,
    unitPrice,
    totalPrice,
  };
}

function scalePrice(
  price: NonNullable<AiQuoteItem['unitPrice']>,
  quantity: number,
): NonNullable<AiQuoteItem['totalPrice']> {
  const scale = (value: number | undefined): number | undefined => (value == null ? undefined : value * quantity);
  return {
    value: scale(price.value),
    gross: scale(price.gross),
    net: scale(price.net),
    tax: scale(price.tax),
    currency: price.currency,
  };
}

/** Flatten Emporix quote line items onto Helper QuoteItemData rows. */
export const mapAiQuoteItems = (items: unknown, locale?: string): AiQuoteItem[] => {
  if (!Array.isArray(items)) {
    return [];
  }
  const mapped: AiQuoteItem[] = [];
  for (const item of items) {
    const row = mapOneQuoteItem(item, locale);
    if (row) {
      mapped.push(row);
    }
  }
  return mapped;
};
