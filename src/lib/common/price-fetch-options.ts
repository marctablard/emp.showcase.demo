import type { Session } from '@/platform/services/model/session/session';
import { isAuthenticatedSessionCustomerId } from './customer-identity';

/**
 * Cache-busting key for client-side product/price fetches:
 * site + currency + shopper company context.
 */
export function buildSessionPricingScopeKey(
  session: Pick<Session, 'siteCode' | 'currency' | 'customerId' | 'legalEntityId'> | null | undefined,
): string {
  if (!session?.siteCode || !session?.currency) {
    return '';
  }
  const customerId = isAuthenticatedSessionCustomerId(session.customerId) ? session.customerId : 'anonymous';
  const legalEntityId = typeof session.legalEntityId === 'string' ? session.legalEntityId.trim() : '';
  return `${session.siteCode}|${session.currency}|${customerId}|${legalEntityId}`;
}
