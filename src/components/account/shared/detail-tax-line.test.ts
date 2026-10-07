import { detailTaxRateSuffix, resolveDetailTaxRatePercent, shouldDisplayTaxLine } from './detail-tax-line';

describe('detail-tax-line', () => {
  describe('shouldDisplayTaxLine', () => {
    it('hides when taxRate is 0 even if amount is present', () => {
      expect(shouldDisplayTaxLine({ taxRate: 0, taxAmount: 0 })).toBe(false);
      expect(shouldDisplayTaxLine({ taxRate: 0, taxAmount: 1.5 })).toBe(false);
    });

    it('hides when taxAmount is 0 even if taxRate is positive (e.g. free shipping)', () => {
      expect(shouldDisplayTaxLine({ taxRate: 7, taxAmount: 0 })).toBe(false);
      expect(shouldDisplayTaxLine({ taxRate: 19, taxAmount: 0 })).toBe(false);
    });

    it('shows when taxRate is positive and taxAmount is positive or omitted', () => {
      expect(shouldDisplayTaxLine({ taxRate: 19, taxAmount: 20.9 })).toBe(true);
      expect(shouldDisplayTaxLine({ taxRate: 7 })).toBe(true);
    });

    it('falls back to positive taxAmount when rate is absent', () => {
      expect(shouldDisplayTaxLine({ taxAmount: 1.71 })).toBe(true);
      expect(shouldDisplayTaxLine({ taxAmount: 0 })).toBe(false);
      expect(shouldDisplayTaxLine({})).toBe(false);
    });
  });

  describe('resolveDetailTaxRatePercent / detailTaxRateSuffix', () => {
    it('prefers model taxRate without integer-rounding decimals', () => {
      expect(resolveDetailTaxRatePercent({ taxRate: 19.4, taxAmount: 10, netAmount: 100 })).toBe(19.4);
      expect(detailTaxRateSuffix({ taxRate: 7, taxAmount: 1 })).toBe(' (7%)');
      expect(detailTaxRateSuffix({ taxRate: 7.7, taxAmount: 7.7 })).toBe(' (7.7%)');
      expect(detailTaxRateSuffix({ taxRate: 3.7, taxAmount: 0.74 })).toBe(' (3.7%)');
    });

    it('does not invent a blended rate from tax/net when taxRate is absent', () => {
      expect(resolveDetailTaxRatePercent({ taxAmount: 575.74, netAmount: 7942 })).toBeUndefined();
      expect(detailTaxRateSuffix({ taxAmount: 575.74, netAmount: 7942 })).toBe('');
    });

    it('returns empty suffix when the line should not display', () => {
      expect(detailTaxRateSuffix({ taxRate: 0, taxAmount: 0 })).toBe('');
      expect(detailTaxRateSuffix({ taxRate: 7, taxAmount: 0 })).toBe('');
    });
  });
});
