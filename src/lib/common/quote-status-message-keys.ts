import { isQuoteStatusValue } from '@/lib/common/status-tag-variants';
import type { QuoteStatus } from '@/platform/services/model/quote';

/**
 * Keys under `account.quoteStatus` for each {@link QuoteStatus}.
 * Canonical storefront statuses: CREATING, AWAITING, OPEN, IN_PROGRESS, ACCEPTED, DECLINED, DECLINED_BY_MERCHANT, EXPIRED;
 * plus legacy Emporix values still mapped in the service layer.
 */
export type QuoteStatusMessageKey =
  | 'creating'
  | 'awaiting'
  | 'open'
  | 'in_progress'
  | 'accepted'
  | 'declined'
  | 'declined_by_merchant'
  | 'expired'
  | 'order_created'
  | 'closed'
  | 'change'
  | 'decline';

export const QUOTE_STATUS_TO_MESSAGE_KEY: Record<QuoteStatus, QuoteStatusMessageKey> = {
  CREATING: 'creating',
  AWAITING: 'awaiting',
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  DECLINED_BY_MERCHANT: 'declined_by_merchant',
  EXPIRED: 'expired',
  ORDER_CREATED: 'order_created',
  CLOSED: 'closed',
  CHANGE: 'change',
  DECLINE: 'decline',
};

export function getQuoteStatusDisplayLabel(status: string, translate: (key: QuoteStatusMessageKey) => string): string {
  const normalized = (status || '').toUpperCase().replace(/-/g, '_');
  if (!isQuoteStatusValue(normalized)) {
    return status;
  }
  const key = QUOTE_STATUS_TO_MESSAGE_KEY[normalized as QuoteStatus];
  return translate(key);
}
