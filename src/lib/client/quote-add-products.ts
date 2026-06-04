import type {
  QuoteAddItemNotification,
  QuoteAddItemResponseStatus,
} from '@/platform/services/model/quote-add-item-notification/quote-add-item-notification';

export interface AddProductsToQuoteItem {
  productId: string;
  quantity: number;
}

export interface QuoteAddProductRequest {
  productId: string;
  notificationId: string;
}

export interface AddProductsToQuoteResult {
  accepted: boolean;
  requests?: QuoteAddProductRequest[];
  error?: string;
  failures?: Array<{ productId: string; status: number; message: string }>;
}

export interface QuoteAddItemOutcome {
  productId: string;
  notificationId: string;
  responseStatus: QuoteAddItemResponseStatus;
  responseMessage?: string;
}

const POLL_INTERVAL_MS = 1000;
const MAX_POLL_MS = 120_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function addProductsToQuote(
  quoteId: string,
  items: AddProductsToQuoteItem[],
): Promise<AddProductsToQuoteResult> {
  const response = await fetch('/api/quote/add-products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoteId, items }),
  });

  const data = (await response.json().catch(() => ({}))) as AddProductsToQuoteResult & {
    error?: string;
    failures?: AddProductsToQuoteResult['failures'];
    requests?: QuoteAddProductRequest[];
    accepted?: boolean;
  };

  if (!response.ok) {
    return {
      accepted: false,
      error: data.error || 'Failed to add products to quote',
      failures: data.failures,
      requests: data.requests,
    };
  }

  return {
    accepted: data.accepted === true,
    requests: data.requests ?? [],
  };
}

export async function fetchQuoteAddItemNotification(notificationId: string): Promise<QuoteAddItemNotification | null> {
  const response = await fetch(`/api/quote/add-item-notifications/${encodeURIComponent(notificationId)}`);
  const data = (await response.json().catch(() => ({}))) as {
    notification?: QuoteAddItemNotification;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch add-to-quote notification');
  }

  return data.notification ?? null;
}

function isResponseStatusResolved(status: QuoteAddItemResponseStatus | undefined): boolean {
  return status === 'SUCCESS' || status === 'DENIED';
}

export async function pollQuoteAddItemOutcomes(requests: QuoteAddProductRequest[]): Promise<QuoteAddItemOutcome[]> {
  const start = Date.now();

  while (Date.now() - start < MAX_POLL_MS) {
    const notifications = await Promise.all(requests.map((r) => fetchQuoteAddItemNotification(r.notificationId)));

    const outcomes: QuoteAddItemOutcome[] = requests.map((request, index) => {
      const notification = notifications[index];
      return {
        productId: request.productId,
        notificationId: request.notificationId,
        responseStatus: notification?.responseStatus ?? '',
        responseMessage: notification?.responseMessage,
      };
    });

    if (outcomes.every((outcome) => isResponseStatusResolved(outcome.responseStatus))) {
      return outcomes;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error('Timed out waiting for add-to-quote results');
}
