'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useCheckoutAddressBook } from '@/hooks/checkout/useCheckoutAddressBook';
import type { AddressType } from '@/platform/services/model/common';
import type { CustomerAddress } from '@/platform/services/model/customer/customer';
import { useCheckoutStore } from '@/providers/StoreProvider';
import type { AddressListData, StructuredDataHandlers } from '../types';
import { addressRoleFromCaption } from '../utils/response-parser';
import { WidgetSkeleton } from './WidgetSkeleton';
import { AiAddressList, AiWidgetFrame } from './ai-widget-kit';

interface AddressListRendererProps {
  data: AddressListData;
  handlers?: StructuredDataHandlers;
  caption?: string;
}

type AddressEntry = React.ComponentProps<typeof AiAddressList>['addresses'][number];
type SelectableAddress = AddressEntry & { id: string };

const addressSummary = (address: AddressEntry): string =>
  [address.name, address.addressLine1, [address.postalCode, address.city].filter(Boolean).join(' '), address.country]
    .filter(Boolean)
    .join(', ');

const toAddressEntry = (address: CustomerAddress): AddressEntry => ({
  id: address.id,
  name: address.contactName,
  company: address.companyName && address.companyName !== address.contactName ? address.companyName : undefined,
  addressLine1: [address.street, address.streetNumber].filter(Boolean).join(' '),
  addressLine2: address.streetAppendix,
  postalCode: address.zipCode,
  city: address.city,
  state: address.state,
  country: address.country,
  tags: address.tags,
});

function AddressRows({
  addresses,
  onSelect,
}: Readonly<{ addresses: AddressEntry[]; onSelect?: (address: SelectableAddress) => void }>) {
  const t = useTranslations('checkout.aiAddressSelect');
  return (
    <AiWidgetFrame>
      <AiAddressList addresses={addresses} onSelect={onSelect} selectLabel={t('use')} />
    </AiWidgetFrame>
  );
}

/** Same book as the storefront checkout: company locations for B2B, the profile book otherwise. */
function CheckoutAddressBook({
  addressType,
  onSelect,
}: Readonly<{ addressType?: AddressType; onSelect?: (address: SelectableAddress) => void }>) {
  const { addresses, loading } = useCheckoutAddressBook(addressType);
  if (loading) {
    return <WidgetSkeleton rows={1} />;
  }
  const rows = addresses.map(toAddressEntry);
  return rows.length > 0 ? <AddressRows addresses={rows} onSelect={onSelect} /> : null;
}

const CHECKOUT_ROLES: AddressType[] = ['SHIPPING', 'BILLING'];

/** Without a step from the agent, an address serves every checkout role it is tagged for. */
const rolesFor = (address: CustomerAddress, step: AddressType | undefined): AddressType[] => {
  if (step) {
    return [step];
  }
  const tagged = CHECKOUT_ROLES.filter((role) => address.tags.some((tag) => tag.toUpperCase() === role));
  return tagged.length > 0 ? tagged : CHECKOUT_ROLES;
};

export const AddressListRenderer: React.FC<AddressListRendererProps> = ({ data, handlers, caption }) => {
  const t = useTranslations('checkout.aiAddressSelect');
  const { addresses: checkoutBook } = useCheckoutAddressBook();
  const { setShippingAddress, setBillingAddress } = useCheckoutStore();
  const step = data.addressType ?? addressRoleFromCaption(caption || data.message || '');

  // The order is placed by the storefront checkout, which needs the full address (company locations included).
  const applyToCheckout = (id: string) => {
    const address = checkoutBook.find((candidate) => candidate.id === id);
    if (!address) {
      return;
    }
    for (const role of rolesFor(address, step)) {
      const checkoutAddress = { ...address, type: role };
      if (role === 'SHIPPING') {
        setShippingAddress(checkoutAddress);
      } else {
        setBillingAddress(checkoutAddress);
      }
    }
  };

  const selectAddress = handlers
    ? (address: SelectableAddress) => {
        applyToCheckout(address.id);
        const message = t('message', { id: address.id, address: addressSummary(address) });
        handlers.setQuestionValue(message);
        requestAnimationFrame(() => {
          handlers.handleQuestionSubmit({ question: message });
        });
      }
    : undefined;

  const hasAddresses = Boolean(data.addresses && data.addresses.length > 0);

  return (
    <div className="space-y-2">
      {data.message ? <p className="px-1 text-sm text-text-body">{data.message}</p> : null}
      {hasAddresses ? <AddressRows addresses={data.addresses ?? []} onSelect={selectAddress} /> : null}
      {!hasAddresses && data.loadFromAccount ? (
        <CheckoutAddressBook addressType={data.addressType} onSelect={selectAddress} />
      ) : null}
    </div>
  );
};
