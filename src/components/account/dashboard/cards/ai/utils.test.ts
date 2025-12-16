import {
  extractPrice,
  formatDate,
  formatDateTime,
  formatPrice,
  getOrderStatusColor,
  getQuoteStatusColor,
  getReturnStatusColor,
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

  it('should handle undefined currency with fallback', () => {
    expect(formatPrice(99.99, undefined)).toBe('$99.99');
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

describe('getQuoteStatusColor', () => {
  it('should return success color for ACCEPTED', () => {
    expect(getQuoteStatusColor('ACCEPTED')).toContain('bg-surface-success');
  });

  it('should return success color for ORDER_CREATED', () => {
    expect(getQuoteStatusColor('ORDER_CREATED')).toContain('bg-surface-success');
  });

  it('should return warning color for IN_PROGRESS', () => {
    expect(getQuoteStatusColor('IN_PROGRESS')).toContain('bg-surface-warning');
  });

  it('should return error color for DECLINED', () => {
    expect(getQuoteStatusColor('DECLINED')).toContain('bg-surface-error');
  });

  it('should return info color for OPEN', () => {
    expect(getQuoteStatusColor('OPEN')).toContain('bg-surface-information');
  });

  it('should handle lowercase status', () => {
    expect(getQuoteStatusColor('accepted')).toContain('bg-surface-success');
  });

  it('should return disabled color for unknown status', () => {
    expect(getQuoteStatusColor('UNKNOWN')).toContain('bg-surface-disabled');
  });
});

describe('getOrderStatusColor', () => {
  it('should return success color for COMPLETED', () => {
    expect(getOrderStatusColor('COMPLETED')).toContain('bg-surface-success');
  });

  it('should return success color for SHIPPED', () => {
    expect(getOrderStatusColor('SHIPPED')).toContain('bg-surface-success');
  });

  it('should return success color for DELIVERED', () => {
    expect(getOrderStatusColor('DELIVERED')).toContain('bg-surface-success');
  });

  it('should return warning color for PENDING', () => {
    expect(getOrderStatusColor('PENDING')).toContain('bg-surface-warning');
  });

  it('should return warning color for PROCESSING', () => {
    expect(getOrderStatusColor('PROCESSING')).toContain('bg-surface-warning');
  });

  it('should return error color for CANCELLED', () => {
    expect(getOrderStatusColor('CANCELLED')).toContain('bg-surface-error');
  });

  it('should return disabled color for unknown status', () => {
    expect(getOrderStatusColor('UNKNOWN')).toContain('bg-surface-disabled');
  });
});

describe('getReturnStatusColor', () => {
  it('should return success color for APPROVED', () => {
    expect(getReturnStatusColor('APPROVED')).toContain('bg-surface-success');
  });

  it('should return warning color for PENDING', () => {
    expect(getReturnStatusColor('PENDING')).toContain('bg-surface-warning');
  });

  it('should return error color for REJECTED', () => {
    expect(getReturnStatusColor('REJECTED')).toContain('bg-surface-error');
  });

  it('should return disabled color for CLOSED', () => {
    expect(getReturnStatusColor('CLOSED')).toContain('bg-surface-disabled');
  });
});
