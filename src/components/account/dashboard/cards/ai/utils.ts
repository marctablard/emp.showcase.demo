import { format } from 'date-fns';
import type { BadgeVariant } from '@/components/ui/badge';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import {
  getOrderStatusVariant,
  getQuoteStatusVariant,
  getReturnStatusVariant,
  isOrderStatusValue,
  isQuoteStatusValue,
  isReturnStatusValue,
  normalizeStatusKey,
} from '@/lib/common/status-tag-variants';

/**
 * Helper function to safely format currency
 */
export const formatPrice = (price: number, currency: string | undefined, fallbackCurrency?: string) => {
  const currencyToUse = currency || fallbackCurrency || getPublicDefaultCurrency();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyToUse,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currencyToUse}`;
  }
};

/**
 * Formats a date to a localized time string
 */
export const formatTimestamp = (date: Date): string => {
  return date.toLocaleTimeString();
};

function toValidDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Formats a date to a localized date string (e.g., "Jan 15, 2024")
 */
export const formatDate = (date: unknown, _locale: string = 'en-US'): string => {
  const dateObj = toValidDate(date);
  if (!dateObj) {
    return typeof date === 'string' && date.length > 0 ? date : 'N/A';
  }
  try {
    return format(dateObj, 'MMM d, yyyy');
  } catch {
    return typeof date === 'string' ? date : 'N/A';
  }
};

/**
 * Formats a date with time to a localized string (e.g., "January 15, 2024 2:30 PM")
 */
export const formatDateTime = (date: unknown, _locale: string = 'en-US'): string => {
  const dateObj = toValidDate(date);
  if (!dateObj) {
    return typeof date === 'string' && date.length > 0 ? date : 'N/A';
  }

  try {
    return format(dateObj, 'MMMM d, yyyy h:mm a');
  } catch {
    return typeof date === 'string' ? date : 'N/A';
  }
};

/** Maps AI / API order status strings to the same variants as {@link OrderStatusBadge}. */
export function getOrderStatusBadgeVariantForAi(status: unknown): BadgeVariant {
  const key = normalizeStatusKey(status);
  if (!isOrderStatusValue(key)) return 'outline';
  return getOrderStatusVariant(key);
}

/** Maps AI / API quote status strings to the same variants as {@link QuoteStatusBadge}. */
export function getQuoteStatusBadgeVariantForAi(status: unknown): BadgeVariant {
  const key = normalizeStatusKey(status);
  if (!isQuoteStatusValue(key)) return 'outline';
  return getQuoteStatusVariant(key);
}

/** Maps AI / API return status strings to the same variants as {@link ReturnStatusBadge}. */
export function getReturnStatusBadgeVariantForAi(status: unknown): BadgeVariant {
  const key = normalizeStatusKey(status);
  if (!isReturnStatusValue(key)) return 'default';
  return getReturnStatusVariant(key);
}

/**
 * Handler for image load errors - hides the image element
 */
export const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>): void => {
  (e.target as HTMLImageElement).style.display = 'none';
};

/**
 * Extracts and normalizes price values from various API response formats.
 * Handles multiple property naming conventions and calculates missing values when possible.
 *
 * Supports formats:
 * - Standard format: { net, gross, tax }
 * - Emporix format: { netValue, grossValue, taxValue }
 * - Final value format: { finalNetValue, finalGrossValue, finalTaxValue }
 * - Fallback format: { value }
 *
 * @param priceObj - Price object from API response
 * @returns Normalized price object with net, gross, and tax properties
 */
export const extractPrice = (priceObj: any): { net: number; gross: number; tax: number } => {
  if (!priceObj) return { net: 0, gross: 0, tax: 0 };

  // Extract values from various property naming conventions
  let net = priceObj.net ?? priceObj.netValue ?? priceObj.finalNetValue;
  let gross = priceObj.gross ?? priceObj.grossValue ?? priceObj.finalGrossValue;
  let tax = priceObj.tax ?? priceObj.taxValue ?? priceObj.finalTaxValue;
  const value = priceObj.value ?? 0;

  // Calculate missing values from available ones
  if (gross != null && tax != null && net == null) {
    // If we have gross and tax, calculate net
    net = gross - tax;
  } else if (gross != null && net != null && tax == null) {
    // If we have gross and net, calculate tax
    tax = gross - net;
  } else if (net != null && tax != null && gross == null) {
    // If we have net and tax, calculate gross
    gross = net + tax;
  } else if (value > 0 && net == null && gross == null && tax == null) {
    // If we only have value, treat it as gross (most common case)
    gross = value;
  } else if (gross == null && value > 0) {
    // Fallback: use value as gross if gross is missing
    gross = value;
  }

  return {
    net: net ?? 0,
    gross: gross ?? 0,
    tax: tax ?? 0,
  };
};
