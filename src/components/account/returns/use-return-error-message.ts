'use client';

import { useTranslations } from 'next-intl';
import { ReturnApiError } from '@/lib/client/returns';
import type { ReturnErrorParams } from '@/lib/common/returns/return-error-codes';

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
 * Translates a returns API failure. The server also sends an English `error` text, but that one
 * is diagnostic and stays in the logs.
 *
 * Returns `undefined` when the failure carries no code this namespace knows. The calling surface
 * then supplies a sentence that fits its own context — loading a list reads differently from
 * submitting a return, and one shared fallback got that wrong.
 */
export function useReturnErrorMessage(): (error: unknown) => string | undefined {
  const t = useTranslations('account.returns.apiError');

  return (error: unknown): string | undefined => {
    if (!(error instanceof ReturnApiError) || !error.code || !t.has(error.code)) {
      return undefined;
    }

    return t(error.code, toMessageValues(error.params));
  };
}
