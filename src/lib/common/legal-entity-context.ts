/**
 * B2B “current company”: session context attribute (company switcher) wins over
 * customer profile’s first legal entity (EmporixCustomerService default).
 */
export function resolveLegalEntityIdFromSessionAndCustomer(
  session: { legalEntityId?: string } | null | undefined,
  customer: { legalEntityId?: string } | null | undefined,
): string | undefined {
  const fromSession = session?.legalEntityId;
  if (typeof fromSession === 'string' && fromSession.trim()) {
    return fromSession.trim();
  }
  const fromCustomer = customer?.legalEntityId;
  if (typeof fromCustomer === 'string' && fromCustomer.trim()) {
    return fromCustomer.trim();
  }
  return undefined;
}
