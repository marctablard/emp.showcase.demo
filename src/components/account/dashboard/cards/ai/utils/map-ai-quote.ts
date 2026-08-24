import type { PaginationData, QuoteData, QuoteListData, QuotePreviewItemData } from '../types';

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

function readStatus(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  return readString(asRecord(value)?.value) ?? '';
}

function customerName(customer: unknown): string | undefined {
  const record = asRecord(customer);
  if (!record) {
    return undefined;
  }
  const full = `${readString(record.firstName) ?? ''} ${readString(record.lastName) ?? ''}`.trim();
  return full.length > 0 ? full : undefined;
}

function mapPreviewItems(items: unknown, locale?: string): QuotePreviewItemData[] | undefined {
  if (!Array.isArray(items)) {
    return undefined;
  }

  const mapped: QuotePreviewItemData[] = [];
  for (const item of items) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }
    const product = asRecord(record.product);
    const quantityRecord = asRecord(record.quantity);
    const media = asRecord(product?.media);
    const name = localizedText(product?.name, locale) ?? readString(record.name);
    if (!name) {
      continue;
    }
    mapped.push({
      name,
      image: readString(media?.url) ?? readString(record.image),
      quantity: readNumber(quantityRecord?.quantity) ?? readNumber(record.quantity) ?? 0,
    });
  }

  return mapped.length > 0 ? mapped : undefined;
}

/**
 * Frontend Agent often embeds a Quote Service resource (`id`, `status.value`,
 * `metadata.createdAt`, `totalPrice`) instead of the Helper widget DTO.
 */
export function mapAiQuote(raw: unknown, locale?: string): QuoteData {
  const quote = asRecord(raw) ?? {};
  const totalPrice = asRecord(quote.totalPrice);
  const metadata = asRecord(quote.metadata);
  const items = Array.isArray(quote.items) ? quote.items : undefined;
  const previewItems = Array.isArray(quote.previewItems)
    ? mapPreviewItems(quote.previewItems, locale)
    : mapPreviewItems(items, locale);

  return {
    quoteId: readString(quote.quoteId) ?? readString(quote.id) ?? '',
    reference: readString(quote.reference) ?? readString(quote.customerReference),
    status: readStatus(quote.status),
    submittedDate: readString(quote.submittedDate) ?? readString(metadata?.createdAt) ?? '',
    validTo: readString(quote.validTo),
    totalGross: readNumber(quote.totalGross) ?? readNumber(totalPrice?.grossValue),
    totalNet: readNumber(quote.totalNet) ?? readNumber(totalPrice?.netValue),
    totalVat: readNumber(quote.totalVat) ?? readNumber(totalPrice?.taxValue),
    currency: readString(quote.currency) ?? readString(totalPrice?.currency),
    itemCount: readNumber(quote.itemCount) ?? items?.length,
    customerName: readString(quote.customerName) ?? customerName(quote.customer),
    previewItems,
  };
}

function readPagination(value: unknown): PaginationData | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }
  const page = readNumber(record.page);
  const totalPages = readNumber(record.totalPages);
  const totalItems = readNumber(record.totalItems);
  if (page === undefined || totalPages === undefined || totalItems === undefined) {
    return undefined;
  }
  return { page, totalPages, totalItems };
}

export function mapAiQuoteList(data: unknown, locale?: string): QuoteListData & { quotes: QuoteData[] } {
  const record = asRecord(data);
  const quotesRaw = record && Array.isArray(record.quotes) ? record.quotes : [];
  return {
    quotes: quotesRaw.map((quote) => mapAiQuote(quote, locale)),
    message: readString(record?.message),
    pagination: readPagination(record?.pagination),
  };
}
