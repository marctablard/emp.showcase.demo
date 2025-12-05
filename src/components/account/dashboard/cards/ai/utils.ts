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
 * Formats a date to a localized date string
 */
export const formatDate = (date: Date | string, locale: string = 'en-US'): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return typeof date === 'string' ? date : date.toISOString();
  }
};

/**
 * Formats a date with time to a localized string
 */
export const formatDateTime = (date: Date | string | undefined | null, locale: string = 'en-US'): string => {
  if (!date) {
    return 'N/A';
  }

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
