import { Return } from '@/platform/services/model/return';
import { formatReturnCurrency, formatReturnDate, getFirstOrderId, getRequestorEmail } from './helpers';

const makeReturn = (overrides: Partial<Return> = {}): Return => ({
  id: 'ret-1',
  status: 'PENDING',
  received: false,
  isExpired: false,
  orders: [],
  ...overrides,
});

describe('formatReturnDate', () => {
  it('formats a valid date string', () => {
    const result = formatReturnDate('2025-06-15T10:00:00Z', 'en-US');
    expect(result).toBe('06/15/2025');
  });

  it('formats a date with de locale', () => {
    const result = formatReturnDate('2025-06-15T10:00:00Z', 'de-DE');
    expect(result).toBe('15.06.2025');
  });

  it('returns "-" for undefined input', () => {
    expect(formatReturnDate(undefined, 'en-US')).toBe('-');
  });
});

describe('formatReturnCurrency', () => {
  it('formats a valid amount with currency', () => {
    const result = formatReturnCurrency(42.5, 'EUR', 'en-US');
    const expected = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(42.5);

    expect(result).toBe(expected);
  });

  it('returns "-" when value is undefined', () => {
    expect(formatReturnCurrency(undefined, 'EUR', 'en-US')).toBe('-');
  });

  it('returns "-" when currency is undefined', () => {
    expect(formatReturnCurrency(42.5, undefined, 'en-US')).toBe('-');
  });

  it('formats zero value', () => {
    const result = formatReturnCurrency(0, 'USD', 'en-US');
    const expected = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0);

    expect(result).toBe(expected);
  });
});

describe('getFirstOrderId', () => {
  it('returns the first order id', () => {
    const ret = makeReturn({
      orders: [{ id: 'order-123', items: [] }],
    });
    expect(getFirstOrderId(ret)).toBe('order-123');
  });

  it('returns "-" when orders array is empty', () => {
    const ret = makeReturn({ orders: [] });
    expect(getFirstOrderId(ret)).toBe('-');
  });
});

describe('getRequestorEmail', () => {
  it('returns the requestor email', () => {
    const ret = makeReturn({
      requestor: { email: 'user@example.com' },
    });
    expect(getRequestorEmail(ret)).toBe('user@example.com');
  });

  it('returns "-" when requestor is undefined', () => {
    const ret = makeReturn({ requestor: undefined });
    expect(getRequestorEmail(ret)).toBe('-');
  });

  it('returns "-" when email is undefined', () => {
    const ret = makeReturn({ requestor: { customerId: 'c1' } });
    expect(getRequestorEmail(ret)).toBe('-');
  });
});
