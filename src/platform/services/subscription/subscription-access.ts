/**
 * Who may see a subscription. Identity comes from the signed-in session, never
 * from an id the browser sends.
 */
export type SubscriptionActor = {
  customerId: string;
  legalEntityId?: string;
  companyAdmin: boolean;
};

export type SubscriptionScope = {
  customerId?: string;
  companyId?: string;
};

export class SubscriptionRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SubscriptionRequestError';
    this.status = status;
  }
}

export function canReadSubscription(subscription: SubscriptionScope, actor: SubscriptionActor): boolean {
  if (subscription.customerId && subscription.customerId === actor.customerId) return true;
  if (actor.companyAdmin && actor.legalEntityId && subscription.companyId === actor.legalEntityId) return true;
  return false;
}

export type CompanyListDecision = { ok: true; companyId: string } | { ok: false; status: 403; message: string };

/** Company-wide list. A customer is refused. An admin is limited to their selected company. */
export function companyListDecision(actor: SubscriptionActor, requestedCompanyId?: string): CompanyListDecision {
  if (!actor.companyAdmin) {
    return { ok: false, status: 403, message: 'A customer cannot list every subscription of the company.' };
  }
  if (!actor.legalEntityId) {
    return { ok: false, status: 403, message: 'No company is selected.' };
  }
  if (requestedCompanyId && requestedCompanyId !== actor.legalEntityId) {
    return { ok: false, status: 403, message: 'You do not administer this company.' };
  }
  return { ok: true, companyId: actor.legalEntityId };
}
