import { formatCurrency } from '@/lib/utils';
import type { Return } from '@/platform/services/model/return';

export function formatReturnDate(dateString: string | undefined, locale: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatReturnCurrency(value: number | undefined, currency: string | undefined, locale?: string): string {
  if (value === undefined || !currency) return '-';
  return formatCurrency(value, currency, locale);
}

export function getFirstOrderId(returnItem: Return): string {
  return returnItem.orders[0]?.id || '-';
}

export function getRequestorEmail(returnItem: Return): string {
  return returnItem.requestor?.email || '-';
}

/**
 * Customer display name for the Returns list. Falls back through the requestor's
 * fullName, composed first/last name, and email before rendering the placeholder.
 * These fields are display-only and must never be sent upstream as query/sort params.
 */
export function getReturnCustomerName(returnItem: Return): string {
  const requestor = returnItem.requestor;
  if (!requestor) return '-';

  const fullName = requestor.fullName?.trim();
  if (fullName) return fullName;

  const composedName = [requestor.firstName, requestor.lastName].filter(Boolean).join(' ').trim();
  if (composedName) return composedName;

  return requestor.email || '-';
}

/**
 * Net Return Value per the COP-6026 contract: calculatedPrice.finalPrice.netValue only,
 * with its mapped currency when present. No fallback to total/orders item values.
 */
export function getNetReturnValue(returnItem: Return): { value: number | undefined; currency: string | undefined } {
  return {
    value: returnItem.calculatedPrice?.finalPrice?.netValue,
    currency: returnItem.calculatedPrice?.finalPrice?.currency,
  };
}

/**
 * Top-level return reason code only (never an item-level reason). `undefined` when absent.
 */
export function getReturnReasonCode(returnItem: Return): string | undefined {
  return returnItem.reason?.code;
}
