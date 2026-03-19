import { getReturnReasonLabel, getReturnReasonTranslationKey } from './reason-labels';

describe('reason-labels', () => {
  it('uses shared translation key mapping including SIZE_FIT', () => {
    expect(getReturnReasonTranslationKey('DEFECTIVE')).toBe('claimReasons.DEFECTIVE');
    expect(getReturnReasonTranslationKey('SIZE_FIT')).toBe('claimReasons.SIZE_FIT');
  });

  it('falls back to humanized reason code for unknown values', () => {
    expect(getReturnReasonLabel('CUSTOM_REASON')).toBe('Custom Reason');
  });
});
