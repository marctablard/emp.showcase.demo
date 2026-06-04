/**
 * Final status from the async add-to-quote workflow.
 * Empty string means the background check is still in progress.
 */
export type QuoteAddItemResponseStatus = '' | 'SUCCESS' | 'DENIED';

export interface QuoteAddItemNotification {
  id: string;
  quoteId?: string;
  productId?: string;
  productQuantity?: string;
  customerId?: string;
  initialRequestId?: string;
  responseStatus: QuoteAddItemResponseStatus;
  responseMessage?: string;
  createdAt?: string;
  modifiedAt?: string;
}
