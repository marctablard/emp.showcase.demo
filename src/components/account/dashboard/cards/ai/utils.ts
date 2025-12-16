import { format } from 'date-fns';

/**
 * Helper function to safely format currency
 */
export const formatPrice = (price: number, currency: string | undefined, fallbackCurrency: string = 'USD') => {
  const currencyToUse = currency || fallbackCurrency;
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

/**
 * Formats a date to a localized date string (e.g., "Jan 15, 2024")
 */
export const formatDate = (date: Date | string, _locale: string = 'en-US'): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'MMM d, yyyy');
  } catch {
    return typeof date === 'string' ? date : date.toISOString();
  }
};

/**
 * Formats a date with time to a localized string (e.g., "January 15, 2024 2:30 PM")
 */
export const formatDateTime = (date: Date | string | undefined | null, _locale: string = 'en-US'): string => {
  if (!date) {
    return 'N/A';
  }

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'MMMM d, yyyy h:mm a');
  } catch {
    return typeof date === 'string' ? date : 'N/A';
  }
};

/**
 * Gets the CSS classes for quote status badges
 */
export const getQuoteStatusColor = (status: string): string => {
  switch (status?.toUpperCase()) {
    case 'CREATING':
    case 'CLOSED':
      return 'bg-surface-disabled text-text-body';
    case 'OPEN':
      return 'bg-surface-information text-text-action-hover';
    case 'IN_PROGRESS':
      return 'bg-surface-warning text-text-warning';
    case 'DECLINED':
      return 'bg-surface-error text-text-error';
    case 'ACCEPTED':
    case 'ORDER_CREATED':
      return 'bg-surface-success text-text-success';
    default:
      return 'bg-surface-disabled text-text-body';
  }
};

/**
 * Gets the CSS classes for order status badges
 */
export const getOrderStatusColor = (status: string): string => {
  const statusUpper = status?.toUpperCase();
  if (statusUpper === 'COMPLETED' || statusUpper === 'SHIPPED' || statusUpper === 'DELIVERED') {
    return 'bg-surface-success text-text-success';
  }
  if (
    statusUpper === 'CONFIRMED' ||
    statusUpper === 'PROCESSING' ||
    statusUpper === 'READY_FOR_PICKUP' ||
    statusUpper === 'READY_FOR_SHIPPING'
  ) {
    return 'bg-surface-warning text-text-warning';
  }
  if (statusUpper === 'PENDING') {
    return 'bg-surface-warning text-text-warning';
  }
  if (statusUpper === 'CANCELLED') {
    return 'bg-surface-error text-text-error';
  }
  return 'bg-surface-disabled text-text-body';
};

/**
 * Gets the CSS classes for return approval status badges
 * Possible values: APPROVED, PENDING, REJECTED, CLOSED
 */
export const getReturnStatusColor = (status: string): string => {
  const statusUpper = status?.toUpperCase();
  if (statusUpper === 'APPROVED') {
    return 'bg-surface-success text-text-success';
  }
  if (statusUpper === 'PENDING') {
    return 'bg-surface-warning text-text-warning';
  }
  if (statusUpper === 'REJECTED') {
    return 'bg-surface-error text-text-error';
  }
  if (statusUpper === 'CLOSED') {
    return 'bg-surface-disabled text-text-body';
  }
  return 'bg-surface-disabled text-text-body';
};

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
