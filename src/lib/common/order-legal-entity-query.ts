/**
 * Merge session `legalEntityId` into an Emporix Order `q` string.
 *
 * `GET /order-v2/{tenant}/orders` is customer-scoped and does not auto-filter by
 * the token LE. OpenAPI `q` matches order fields (`q=currency:USD`); orders carry
 * `legalEntityId`. When a company is selected, AND that clause onto the list query
 * so My Orders only returns orders placed on behalf of that legal entity (COP-5861).
 *
 * Space-separated `q` terms are AND. Session LE replaces any client `legalEntityId:`
 * clause so the storefront cannot query another company.
 */

const LEGAL_ENTITY_Q_FIELD = 'legalEntityId';
const SAFE_LEGAL_ENTITY_ID = /^[A-Za-z0-9_-]+$/;
const LEGAL_ENTITY_CLAUSE = /\blegalEntityId:[^\s]+/g;

export function appendLegalEntityIdToOrderQuery(
  query: string | undefined,
  legalEntityId: string | undefined,
): string | undefined {
  const trimmedQuery = typeof query === 'string' ? query.trim() : '';
  const trimmedLegalEntityId = typeof legalEntityId === 'string' ? legalEntityId.trim() : '';

  if (!trimmedLegalEntityId || !SAFE_LEGAL_ENTITY_ID.test(trimmedLegalEntityId)) {
    return trimmedQuery || undefined;
  }

  const queryWithoutLegalEntity = trimmedQuery.replace(LEGAL_ENTITY_CLAUSE, '').replace(/\s+/g, ' ').trim();
  const clause = `${LEGAL_ENTITY_Q_FIELD}:${trimmedLegalEntityId}`;

  return queryWithoutLegalEntity ? `${queryWithoutLegalEntity} ${clause}` : clause;
}
