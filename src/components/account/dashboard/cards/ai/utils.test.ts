import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import {
  extractPrice,
  formatDate,
  formatDateTime,
  formatPrice,
  getOrderStatusBadgeVariantForAi,
  getQuoteStatusBadgeVariantForAi,
  getReturnStatusBadgeVariantForAi,
} from './utils';

describe('extractPrice', () => {
  it('should return zeros for null input', () => {
    expect(extractPrice(null)).toEqual({ net: 0, gross: 0, tax: 0 });
  });

  it('should return zeros for undefined input', () => {
    expect(extractPrice(undefined)).toEqual({ net: 0, gross: 0, tax: 0 });
  });

  it('should handle standard format with net, gross, tax', () => {
    expect(extractPrice({ net: 100, gross: 119, tax: 19 })).toEqual({ net: 100, gross: 119, tax: 19 });
  });

  it('should handle Emporix format with netValue, grossValue, taxValue', () => {
    expect(extractPrice({ netValue: 100, grossValue: 119, taxValue: 19 })).toEqual({ net: 100, gross: 119, tax: 19 });
  });

  it('should handle final value format', () => {
    expect(extractPrice({ finalNetValue: 100, finalGrossValue: 119, finalTaxValue: 19 })).toEqual({
      net: 100,
      gross: 119,
      tax: 19,
    });
  });

  it('should calculate missing net from gross and tax', () => {
    expect(extractPrice({ gross: 119, tax: 19 })).toEqual({ net: 100, gross: 119, tax: 19 });
  });

  it('should calculate missing tax from gross and net', () => {
    expect(extractPrice({ gross: 119, net: 100 })).toEqual({ net: 100, gross: 119, tax: 19 });
  });

  it('should calculate missing gross from net and tax', () => {
    expect(extractPrice({ net: 100, tax: 19 })).toEqual({ net: 100, gross: 119, tax: 19 });
  });

  it('should use value as gross fallback when no other values', () => {
    expect(extractPrice({ value: 100 })).toEqual({ net: 0, gross: 100, tax: 0 });
  });

  it('should use value as gross fallback when gross is missing', () => {
    expect(extractPrice({ net: 80, tax: 20, value: 100 })).toEqual({ net: 80, gross: 100, tax: 20 });
  });
});

describe('formatPrice', () => {
  it('should format USD currency correctly', () => {
    expect(formatPrice(99.99, 'USD')).toBe('$99.99');
  });

  it('should format EUR currency correctly', () => {
    const result = formatPrice(99.99, 'EUR');
    expect(result).toContain('99.99');
    expect(result).toContain('€');
  });

  it('should handle undefined currency with fallback from env', () => {
    const expected = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: getPublicDefaultCurrency(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(99.99);
    expect(formatPrice(99.99, undefined)).toBe(expected);
  });

  it('should handle undefined currency with custom fallback', () => {
    expect(formatPrice(99.99, undefined, 'EUR')).toContain('€');
  });

  it('should format zero correctly', () => {
    expect(formatPrice(0, 'USD')).toBe('$0.00');
  });

  it('should format large numbers correctly', () => {
    const result = formatPrice(1234567.89, 'USD');
    expect(result).toContain('1,234,567.89');
  });
});

describe('formatDate', () => {
  it('should format Date object correctly', () => {
    const date = new Date('2024-01-15');
    expect(formatDate(date)).toBe('Jan 15, 2024');
  });

  it('should format date string correctly', () => {
    expect(formatDate('2024-01-15')).toBe('Jan 15, 2024');
  });

  it('should handle ISO date strings', () => {
    expect(formatDate('2024-01-15T10:30:00Z')).toBe('Jan 15, 2024');
  });
});

describe('formatDateTime', () => {
  it('should format Date object with time correctly', () => {
    const date = new Date('2024-01-15T14:30:00');
    const result = formatDateTime(date);
    expect(result).toContain('January 15, 2024');
    expect(result).toContain(':30');
  });

  it('should return N/A for null', () => {
    expect(formatDateTime(null)).toBe('N/A');
  });

  it('should return N/A for undefined', () => {
    expect(formatDateTime(undefined)).toBe('N/A');
  });

  it('should format date string correctly', () => {
    const result = formatDateTime('2024-01-15T14:30:00');
    expect(result).toContain('January 15, 2024');
  });
});

describe('getQuoteStatusBadgeVariantForAi', () => {
  it('should return success for ACCEPTED', () => {
    expect(getQuoteStatusBadgeVariantForAi('ACCEPTED')).toBe('success');
  });

  it('should return success for ORDER_CREATED', () => {
    expect(getQuoteStatusBadgeVariantForAi('ORDER_CREATED')).toBe('success');
  });

  it('should return warning for IN_PROGRESS', () => {
    expect(getQuoteStatusBadgeVariantForAi('IN_PROGRESS')).toBe('warning');
  });

  it('should return destructive for DECLINED', () => {
    expect(getQuoteStatusBadgeVariantForAi('DECLINED')).toBe('destructive');
  });

  it('should return information for OPEN', () => {
    expect(getQuoteStatusBadgeVariantForAi('OPEN')).toBe('information');
  });

  it('should handle lowercase status', () => {
    expect(getQuoteStatusBadgeVariantForAi('accepted')).toBe('success');
  });

  it('should return outline for EXPIRED', () => {
    expect(getQuoteStatusBadgeVariantForAi('EXPIRED')).toBe('outline');
  });

  it('should return information for CREATING', () => {
    expect(getQuoteStatusBadgeVariantForAi('CREATING')).toBe('information');
  });

  it('should return muted for CLOSED', () => {
    expect(getQuoteStatusBadgeVariantForAi('CLOSED')).toBe('muted');
  });

  it('should return destructive for CHANGE', () => {
    expect(getQuoteStatusBadgeVariantForAi('CHANGE')).toBe('destructive');
  });

  it('should return outline for unknown status', () => {
    expect(getQuoteStatusBadgeVariantForAi('UNKNOWN')).toBe('outline');
  });
});

describe('getOrderStatusBadgeVariantForAi', () => {
  it('should return muted for COMPLETED', () => {
    expect(getOrderStatusBadgeVariantForAi('COMPLETED')).toBe('muted');
  });

  it('should return success for CONFIRMED', () => {
    expect(getOrderStatusBadgeVariantForAi('CONFIRMED')).toBe('success');
  });

  it('should return success for SHIPPED', () => {
    expect(getOrderStatusBadgeVariantForAi('SHIPPED')).toBe('success');
  });

  it('should return muted for DELIVERED', () => {
    expect(getOrderStatusBadgeVariantForAi('DELIVERED')).toBe('muted');
  });

  it('should return outline for PENDING (non-order enum)', () => {
    expect(getOrderStatusBadgeVariantForAi('PENDING')).toBe('outline');
  });

  it('should return warning for PROCESSING', () => {
    expect(getOrderStatusBadgeVariantForAi('PROCESSING')).toBe('warning');
  });

  it('should return destructive for CANCELLED', () => {
    expect(getOrderStatusBadgeVariantForAi('CANCELLED')).toBe('destructive');
  });

  it('should return destructive for DECLINED', () => {
    expect(getOrderStatusBadgeVariantForAi('DECLINED')).toBe('destructive');
  });

  it('should return outline for unknown status', () => {
    expect(getOrderStatusBadgeVariantForAi('UNKNOWN')).toBe('outline');
  });
});

describe('getReturnStatusBadgeVariantForAi', () => {
  it('should return success for APPROVED', () => {
    expect(getReturnStatusBadgeVariantForAi('APPROVED')).toBe('success');
  });

  it('should return warning for PENDING', () => {
    expect(getReturnStatusBadgeVariantForAi('PENDING')).toBe('warning');
  });

  it('should return destructive for REJECTED', () => {
    expect(getReturnStatusBadgeVariantForAi('REJECTED')).toBe('destructive');
  });

  it('should return muted for CLOSED', () => {
    expect(getReturnStatusBadgeVariantForAi('CLOSED')).toBe('muted');
  });

  it('should return warning for REVIEWED', () => {
    expect(getReturnStatusBadgeVariantForAi('REVIEWED')).toBe('warning');
  });

  it('should return default for unknown status', () => {
    expect(getReturnStatusBadgeVariantForAi('UNKNOWN')).toBe('default');
  });
});
