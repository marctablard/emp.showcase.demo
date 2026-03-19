export const RETURN_REASON_LABEL_KEYS = {
  DEFECTIVE: 'claimReasons.DEFECTIVE',
  DAMAGED: 'claimReasons.DAMAGED',
  WRONG_ITEM: 'claimReasons.WRONG_ITEM',
  NOT_AS_DESCRIBED: 'claimReasons.NOT_AS_DESCRIBED',
  CHANGED_MIND: 'claimReasons.CHANGED_MIND',
  WARRANTY: 'claimReasons.WARRANTY',
  SIZE_FIT: 'claimReasons.SIZE_FIT',
  OTHER: 'claimReasons.OTHER',
} as const;

export type ReturnReasonCode = keyof typeof RETURN_REASON_LABEL_KEYS;
export type ReturnReasonTranslationKey = (typeof RETURN_REASON_LABEL_KEYS)[ReturnReasonCode];

export function getReturnReasonTranslationKey(code: string): ReturnReasonTranslationKey | undefined {
  if (code in RETURN_REASON_LABEL_KEYS) {
    return RETURN_REASON_LABEL_KEYS[code as ReturnReasonCode];
  }

  return undefined;
}

export function getReturnReasonLabel(code: string): string {
  const translationKey = getReturnReasonTranslationKey(code);
  if (!translationKey) {
    return code
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  return translationKey;
}
