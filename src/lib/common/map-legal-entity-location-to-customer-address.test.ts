import { ADDRESS_TYPE } from '@/lib/common/address-type-constants';
import { EMPORIX_LOCATION_TYPE } from '@/lib/common/emporix-location-type';
import type { EmporixLocation } from '@/platform/integrations/emporix/model';
import {
  inferLocationAddressTags,
  mapLegalEntityLocationToCustomerAddress,
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
    expect(mapped).not.toBeNull();
    expect(mapped!.companyName).toBe('ACME GmbH');
    expect(mapped!.street).toBe('Industriestr.');
    expect(mapped!.streetNumber).toBe('1');
    expect(mapped!.zipCode).toBe('10115');
    expect(mapped!.city).toBe('Berlin');
    expect(mapped!.country).toBe('DE');
    expect(mapped!.id).toBe('loc-1');
    expect(mapped!.source).toBe('legalEntity');
    expect(mapped!.contactName).toContain('Main WH');
  });

  it('preserves the raw Emporix location id (no prefix)', () => {
    const mapped = mapLegalEntityLocationToCustomerAddress(baseLocation({ id: '699ec5f3b438a032a7fde0a5' }), 'ACME');
    expect(mapped).not.toBeNull();
    expect(mapped!.id).toBe('699ec5f3b438a032a7fde0a5');
  });

  it('returns null when location id is missing', () => {
    expect(mapLegalEntityLocationToCustomerAddress(baseLocation({ id: undefined }), 'ACME')).toBeNull();
  });

  it('returns null when location id is blank', () => {
    expect(mapLegalEntityLocationToCustomerAddress(baseLocation({ id: '   ' }), 'ACME')).toBeNull();
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
    expect(mapped).not.toBeNull();
    expect(mapped!.street).toBe('Hauptstraße');
    expect(mapped!.streetNumber).toBe('9');
    expect(mapped!.streetAppendix).toBe('Hinterhof');
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
