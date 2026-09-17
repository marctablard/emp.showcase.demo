'use client';

import { useProductsMode } from '@/components/navigation/products-mode-context';
import { useSession } from '@/hooks/session/useSession';
import { useSiteCode } from '@/hooks/site/useSiteCode';
import { buildClientFetchScope } from '@/lib/client/client-fetch-scope';

/**
 * Mode / site / customer identity for client fetch coalescers (COP-4822).
 * `extra` is for an additional dimension such as session currency.
 */
export function useClientFetchScope(extra?: string | null): string {
  const { mode } = useProductsMode();
  const siteCode = useSiteCode();
  const { session } = useSession();
  return buildClientFetchScope({
    mode,
    siteCode: siteCode ?? session?.siteCode,
    customerId: session?.customerId,
    extra,
  });
}
