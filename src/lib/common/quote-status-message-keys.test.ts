import { QUOTE_STATUS_TO_MESSAGE_KEY, getQuoteStatusDisplayLabel } from './quote-status-message-keys';

describe('quote-status-message-keys', () => {
  it('maps every QuoteStatus to an account.quoteStatus message key', () => {
    const keys = Object.values(QUOTE_STATUS_TO_MESSAGE_KEY);
    expect(keys).toContain('in_progress');
    expect(keys).toContain('declined_by_merchant');
    expect(keys).toContain('awaiting');
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('getQuoteStatusDisplayLabel uses normalized API casing', () => {
    const translate = (key: string) => `t:${key}`;
    expect(getQuoteStatusDisplayLabel('IN_PROGRESS', translate)).toBe('t:in_progress');
    expect(getQuoteStatusDisplayLabel('in-progress', translate)).toBe('t:in_progress');
    expect(getQuoteStatusDisplayLabel('AWAITING', translate)).toBe('t:awaiting');
  });

  it('returns raw string for unknown status', () => {
    const translate = (key: string) => `t:${key}`;
    expect(getQuoteStatusDisplayLabel('FAKE_STATUS', translate)).toBe('FAKE_STATUS');
  });
});
