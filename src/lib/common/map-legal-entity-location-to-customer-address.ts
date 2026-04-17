import { ADDRESS_TYPE } from '@/lib/common/address-type-constants';
import { EMPORIX_LOCATION_TYPE } from '@/lib/common/emporix-location-type';
import type { EmporixLocation } from '@/platform/integrations/emporix/model';
import type { AddressType } from '@/platform/services/model/common';
import type { CustomerAddress } from '@/platform/services/model/customer/customer';

export function inferLocationAddressTags(location: EmporixLocation): AddressType[] {
  const tags = location.contactDetails?.tags;
  const billing = tags?.includes(ADDRESS_TYPE.BILLING);
  const shipping = tags?.includes(ADDRESS_TYPE.SHIPPING);
  if (billing && shipping) {
    return [ADDRESS_TYPE.BILLING, ADDRESS_TYPE.SHIPPING];
  }
  if (billing) {
    return [ADDRESS_TYPE.BILLING];
  }
  if (shipping) {
    return [ADDRESS_TYPE.SHIPPING];
  }

  switch (location.type) {
    case EMPORIX_LOCATION_TYPE.HEADQUARTER:
      return [ADDRESS_TYPE.BILLING, ADDRESS_TYPE.SHIPPING];
    case EMPORIX_LOCATION_TYPE.WAREHOUSE:
      return [ADDRESS_TYPE.SHIPPING];
    case EMPORIX_LOCATION_TYPE.OFFICE:
      return [ADDRESS_TYPE.SHIPPING, ADDRESS_TYPE.BILLING];
    default:
      return [ADDRESS_TYPE.SHIPPING];
  }
}

export function mapLegalEntityLocationToCustomerAddress(
  location: EmporixLocation,
  companyDisplayName: string,
): CustomerAddress {
  const cd = location.contactDetails;

  const street = cd?.street ?? cd?.addressLine1 ?? '';

  const onlyLegacyAddressLines =
    cd?.street === undefined && cd?.streetNumber === undefined && cd?.streetAppendix === undefined;

  let streetNumber = onlyLegacyAddressLines ? (cd?.addressLine2 ?? '') : (cd?.streetNumber ?? '');
  let streetAppendix = onlyLegacyAddressLines ? '' : (cd?.streetAppendix ?? '');

  if (!onlyLegacyAddressLines && cd?.addressLine2) {
    if (!streetNumber) {
      if (cd.street !== undefined) {
        if (!streetAppendix) {
          streetAppendix = cd.addressLine2;
        }
      } else {
        streetNumber = cd.addressLine2;
      }
    } else if (!streetAppendix) {
      streetAppendix = cd.addressLine2;
    }
  }

  return {
    id: location.id ? `le-loc:${location.id}` : `le-loc:${encodeURIComponent(location.name)}`,
    contactName: [location.name, location.type].filter(Boolean).join(' — '),
    companyName: companyDisplayName,
    street,
    streetNumber,
    streetAppendix,
    zipCode: cd?.postcode ?? '',
    city: cd?.city ?? '',
    state: cd?.state ?? '',
    country: cd?.countryCode ?? '',
    contactPhone: cd?.phones?.[0],
    tags: inferLocationAddressTags(location),
    isDefault: location.type === EMPORIX_LOCATION_TYPE.HEADQUARTER,
  };
}

export function pickDefaultLegalEntityAddress(
  addresses: CustomerAddress[] | undefined,
  tag: AddressType,
): CustomerAddress | null {
  if (!addresses?.length) {
    return null;
  }
  const withTag = addresses.filter((a) => a.tags.includes(tag));
  if (withTag.length === 0) {
    return null;
  }
  const def = withTag.find((a) => a.isDefault);
  return def ?? withTag[0];
}
