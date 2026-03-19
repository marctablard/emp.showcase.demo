import { normalizeReasonCode, normalizeReasonDetails } from './reason-normalization';

describe('reason-normalization', () => {
  describe('normalizeReasonCode', () => {
    it('normalizes whitespace and uppercases values', () => {
      expect(normalizeReasonCode(' wrong_item ')).toBe('WRONG_ITEM');
      expect(normalizeReasonCode('size_fit')).toBe('SIZE_FIT');
    });

    it('returns undefined for empty or invalid input', () => {
      expect(normalizeReasonCode('   ')).toBeUndefined();
      expect(normalizeReasonCode(undefined)).toBeUndefined();
      expect(normalizeReasonCode(null)).toBeUndefined();
      expect(normalizeReasonCode(123)).toBeUndefined();
    });
  });

  describe('normalizeReasonDetails', () => {
    it('trims valid strings', () => {
      expect(normalizeReasonDetails('  details  ')).toBe('details');
    });

    it('returns undefined for empty or invalid input', () => {
      expect(normalizeReasonDetails('   ')).toBeUndefined();
      expect(normalizeReasonDetails(undefined)).toBeUndefined();
      expect(normalizeReasonDetails(null)).toBeUndefined();
      expect(normalizeReasonDetails(123)).toBeUndefined();
    });
  });
});
