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

function trimmedLegalEntityId(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Selected legal entity for User Management access/display.
 * Session (company switcher) wins when it is in `getCompanies()`. Otherwise
 * recover from the customer-token claim, then profile `legalEntityId`, if that
 * id is permitted. Do not invent `companies[0]`.
 */
export function resolvePermittedSelectedLegalEntityId(input: {
  sessionLegalEntityId?: string;
  tokenLegalEntityId?: string;
  customerLegalEntityId?: string;
  permittedCompanyIds: ReadonlySet<string> | readonly string[];
}): string {
  const companyIds =
    input.permittedCompanyIds instanceof Set ? input.permittedCompanyIds : new Set(input.permittedCompanyIds);
  const candidates = [input.sessionLegalEntityId, input.tokenLegalEntityId, input.customerLegalEntityId];
  for (const candidate of candidates) {
    const id = trimmedLegalEntityId(candidate);
    if (id && companyIds.has(id)) {
      return id;
    }
  }
  return '';
}
