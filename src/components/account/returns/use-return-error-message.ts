'use client';

import { useTranslations } from 'next-intl';
import { type ReturnApiErrorKey, dk } from '@/i18n/dynamic-key';
import { ReturnApiError } from '@/lib/client/returns';
import type { ReturnErrorParams } from '@/lib/common/returns/return-api-error-mapping';

/**
 * next-intl expects an index-signature record; the typed params object is not one,
 * and absent values must be dropped rather than passed as undefined.
 */
function toMessageValues(params: ReturnErrorParams | undefined): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(params ?? {}).filter((entry): entry is [string, string | number] => entry[1] !== undefined),
  );
}

/**
 * Turns a returns API failure into a sentence in the shopper's language. The server also
 * sends an English `error` text, but that one is diagnostic and stays in the logs.
 * Anything without a known code falls back to the generic message.
 */
export function useReturnErrorMessage(): (error: unknown) => string {
  const t = useTranslations('account.returns.apiError');

  return (error: unknown): string => {
    if (!(error instanceof ReturnApiError) || !error.code) {
      return t('UNEXPECTED');
    }

    const key = dk<ReturnApiErrorKey>(error.code);
    return t.has(key) ? t(key, toMessageValues(error.params)) : t('UNEXPECTED');
  };
}
