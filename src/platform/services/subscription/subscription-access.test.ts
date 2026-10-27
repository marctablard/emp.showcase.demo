import { type SubscriptionActor, canReadSubscription, companyListDecision } from './subscription-access';

const customer: SubscriptionActor = { customerId: 'cu-1', legalEntityId: 'le-1', companyAdmin: false };
const admin: SubscriptionActor = { customerId: 'admin-1', legalEntityId: 'le-1', companyAdmin: true };

describe('subscription access', () => {
  it('lets a customer read only their own subscription', () => {
    expect(canReadSubscription({ customerId: 'cu-1', companyId: 'le-1' }, customer)).toBe(true);
    expect(canReadSubscription({ customerId: 'cu-2', companyId: 'le-1' }, customer)).toBe(false);
    expect(canReadSubscription({ customerId: 'cu-2', companyId: 'le-2' }, customer)).toBe(false);
  });

  it('lets a company admin read every subscription of their legal entity', () => {
    expect(canReadSubscription({ customerId: 'cu-2', companyId: 'le-1' }, admin)).toBe(true);
    expect(canReadSubscription({ customerId: 'cu-9', companyId: 'le-2' }, admin)).toBe(false);
  });

  it('refuses a customer asking for the company list', () => {
    expect(companyListDecision(customer)).toEqual({
      ok: false,
      status: 403,
      message: 'A customer cannot list every subscription of the company.',
    });
  });

  it('refuses an admin asking for a company they do not administer', () => {
    expect(companyListDecision(admin, 'le-2')).toEqual({
      ok: false,
      status: 403,
      message: 'You do not administer this company.',
    });
  });

  it('limits an admin list to the selected legal entity', () => {
    expect(companyListDecision(admin)).toEqual({ ok: true, companyId: 'le-1' });
    expect(companyListDecision(admin, 'le-1')).toEqual({ ok: true, companyId: 'le-1' });
  });
});
