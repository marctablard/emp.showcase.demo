import type { AddressType } from '@/platform/services/model/common';

export const ADDRESS_TYPE = {
  SHIPPING: 'SHIPPING',
  BILLING: 'BILLING',
} as const satisfies Record<AddressType, AddressType>;
