import { CUSTOMER_ID } from '@/lib/common/customer-identity';
import { priceFetchOptionsFromSession } from './price-match-session';

describe('priceFetchOptionsFromSession', () => {
  it('requires a site and never enables main-site fallback', () => {
    expect(priceFetchOptionsFromSession({})).toBeUndefined();
    expect(
      priceFetchOptionsFromSession({
        siteCode: 'fw-site',
        currency: 'CHF',
        country: 'CH',
      }),
    ).toEqual({
      siteCode: 'fw-site',
      currency: 'CHF',
      country: 'CH',
      useFallback: false,
    });
  });

  it('sends principal and legal entity only for an authenticated customer', () => {
    expect(
      priceFetchOptionsFromSession({
        siteCode: 'fw-site',
        customerId: CUSTOMER_ID.SESSION_ANONYMOUS,
        legalEntityId: 'le-1',
      }),
    ).toEqual({
      siteCode: 'fw-site',
      legalEntityId: 'le-1',
      useFallback: false,
    });

    expect(
      priceFetchOptionsFromSession(
        {
          siteCode: 'main',
          customerId: '50899020',
          legalEntityId: '  le-1  ',
        },
        'fw-site',
      ),
    ).toEqual({
      siteCode: 'fw-site',
      customerId: '50899020',
      legalEntityId: 'le-1',
      useFallback: false,
    });
  });
});
