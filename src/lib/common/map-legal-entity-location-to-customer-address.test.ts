import { ADDRESS_TYPE } from '@/lib/common/address-type-constants';
import { EMPORIX_LOCATION_TYPE } from '@/lib/common/emporix-location-type';
import type { EmporixLocation } from '@/platform/integrations/emporix/model';
import type { CustomerAddress } from '@/platform/services/model/customer/customer';
import {
  inferLocationAddressTags,
  mapLegalEntityLocationToCustomerAddress,
  pickDefaultLegalEntityAddress,
} from './map-legal-entity-location-to-customer-address';

function baseLocation(overrides: Partial<EmporixLocation> = {}): EmporixLocation {
  return {
    id: 'loc-1',
    name: 'Main WH',
    type: EMPORIX_LOCATION_TYPE.WAREHOUSE,
    contactDetails: {
      addressLine1: 'Industriestr.',
      addressLine2: '1',
      postcode: '10115',
      city: 'Berlin',
      countryCode: 'DE',
    },
    ...overrides,
  };
}

describe('mapLegalEntityLocationToCustomerAddress', () => {
  it('maps contact details and company display name', () => {
    const mapped = mapLegalEntityLocationToCustomerAddress(baseLocation(), 'ACME GmbH');
    expect(mapped.companyName).toBe('ACME GmbH');
    expect(mapped.street).toBe('Industriestr.');
    expect(mapped.streetNumber).toBe('1');
    expect(mapped.zipCode).toBe('10115');
    expect(mapped.city).toBe('Berlin');
    expect(mapped.country).toBe('DE');
    expect(mapped.id).toBe('le-loc:loc-1');
    expect(mapped.contactName).toContain('Main WH');
  });

  it('marks headquarter as default', () => {
    const hq = mapLegalEntityLocationToCustomerAddress(
      baseLocation({ type: EMPORIX_LOCATION_TYPE.HEADQUARTER, id: 'hq' }),
      'ACME',
    );
    expect(hq.isDefault).toBe(true);
  });

  it('maps explicit street, streetNumber, and streetAppendix when provided', () => {
    const mapped = mapLegalEntityLocationToCustomerAddress(
      baseLocation({
        contactDetails: {
          street: 'Hauptstraße',
          streetNumber: '9',
          streetAppendix: 'Hinterhof',
          addressLine1: 'ignored when street set',
          postcode: '10115',
          city: 'Berlin',
          countryCode: 'DE',
        },
      }),
      'ACME GmbH',
    );
    expect(mapped.street).toBe('Hauptstraße');
    expect(mapped.streetNumber).toBe('9');
    expect(mapped.streetAppendix).toBe('Hinterhof');
  });
});

describe('inferLocationAddressTags', () => {
  it('uses contactDetails tags when present', () => {
    const loc = baseLocation({
      contactDetails: {
        ...baseLocation().contactDetails,
        tags: [ADDRESS_TYPE.BILLING],
      },
    });
    expect(inferLocationAddressTags(loc)).toEqual([ADDRESS_TYPE.BILLING]);
  });

  it('defaults warehouse to SHIPPING', () => {
    expect(inferLocationAddressTags(baseLocation({ type: EMPORIX_LOCATION_TYPE.WAREHOUSE }))).toEqual([
      ADDRESS_TYPE.SHIPPING,
    ]);
  });
});

describe('pickDefaultLegalEntityAddress', () => {
  const list: CustomerAddress[] = [
    {
      ...mapLegalEntityLocationToCustomerAddress(
        baseLocation({ id: 'a', type: EMPORIX_LOCATION_TYPE.WAREHOUSE }),
        'Co',
      ),
      tags: [ADDRESS_TYPE.SHIPPING],
      isDefault: false,
    },
    {
      ...mapLegalEntityLocationToCustomerAddress(
        baseLocation({ id: 'b', type: EMPORIX_LOCATION_TYPE.HEADQUARTER, name: 'HQ' }),
        'Co',
      ),
      tags: [ADDRESS_TYPE.BILLING, ADDRESS_TYPE.SHIPPING],
      isDefault: true,
    },
  ];

  it('prefers default for tag when available', () => {
    const picked = pickDefaultLegalEntityAddress(list, ADDRESS_TYPE.BILLING);
    expect(picked?.id).toBe('le-loc:b');
  });

  it('returns null when no address matches tag', () => {
    expect(pickDefaultLegalEntityAddress([], ADDRESS_TYPE.SHIPPING)).toBeNull();
  });
});
