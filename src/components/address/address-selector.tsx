'use client';

import type { ReactNode } from 'react';
import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAddresses } from '@/hooks/customer/useAddresses';
import useCustomer from '@/hooks/customer/useCustomer';
import { useLegalEntityCheckoutAddresses } from '@/hooks/customer/useLegalEntityCheckoutAddresses';
import { useSession as useShopSession } from '@/hooks/session/useSession';
import { ADDRESS_TYPE } from '@/lib/common/address-type-constants';
import { resolveLegalEntityIdFromSessionAndCustomer } from '@/lib/common/legal-entity-context';
import { cn } from '@/lib/utils';
import type { Address, AddressType } from '@/platform/services/model/common';
import type { CustomerAddress } from '@/platform/services/model/customer/customer';

/**
 * - `customer` — force the customer profile book.
 * - `legalEntity` — force the B2B legal-entity locations book.
 * - `auto` — pick one book based on the signed-in customer:
 *     • B2B (businessModel='B2B' with a legalEntityId in session or customer)
 *       → legal-entity locations only, no prefill.
 *     • Everyone else signed in (for example, B2C customers) → customer profile addresses only.
 *   This is the default for checkout/quote flows.
 */
export type AddressBookMode = 'customer' | 'legalEntity' | 'auto';

export interface AddressSelectorProps {
  onSelect: (address: Address) => void;
  triggerElement?: ReactNode;
  selectedAddressId?: string;
  title?: string;
  showAddressTypes?: boolean;
  addressType?: AddressType;
  className?: string;
  addressBook?: AddressBookMode;
}

function filterByAddressRole(
  addresses: CustomerAddress[] | undefined,
  role: AddressType | undefined,
): CustomerAddress[] {
  if (!addresses?.length) {
    return [];
  }
  if (!role) {
    return addresses;
  }
  return addresses.filter((a) => a.tags.includes(role));
}

function formatAddressSummary(address: Address): string {
  const streetSegments = [address.street, address.streetNumber].flatMap((s) => {
    const v = s?.trim();
    return v ? [v] : [];
  });
  const parts = [
    address.contactName,
    ...streetSegments,
    address.streetAppendix,
    `${address.zipCode} ${address.city}`,
    address.state,
    address.country,
  ].filter(Boolean);

  return parts.join(', ');
}

interface AddressSelectorInnerProps extends Omit<AddressSelectorProps, 'addressBook'> {
  flatAddresses: CustomerAddress[] | undefined;
  loading: boolean;
}

function AddressSelectorInner({
  onSelect,
  triggerElement,
  selectedAddressId,
  title,
  showAddressTypes = true,
  addressType: _addressType,
  className,
  flatAddresses,
  loading,
}: AddressSelectorInnerProps) {
  const t = useTranslations('account.AddressForm');
  const [open, setOpen] = useState(false);
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(selectedAddressId);

  const resolvedSelectedId = selectedAddressId ?? internalSelectedId;

  const handleAddressSelect = (address: Address) => {
    if (selectedAddressId === undefined) {
      setInternalSelectedId(address.id);
    }
    onSelect(address);
    setOpen(false);
  };

  const flatList = flatAddresses ?? [];

  const selectedAddress = resolvedSelectedId ? flatList.find((addr) => addr.id === resolvedSelectedId) : undefined;

  const renderAddressBlock = (address: CustomerAddress) => (
    <div
      key={address.id}
      className={cn(
        'p-4 my-2 border rounded-md cursor-pointer transition-colors hover:bg-surface-action-hover-2',
        resolvedSelectedId === address.id
          ? 'bg-surface-action text-text-on-action hover:bg-surface-action-hover hover:text-text-ho'
          : '',
      )}
      onClick={() => handleAddressSelect(address)}
      data-testid={`addressSelector-item-${address.id}`}
    >
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-2">
          <p className="font-bold">{address.contactName}</p>
          {address.source === 'customer' && address.isDefault ? (
            <span className="text-xs px-2 py-0.5 rounded-sm bg-surface-success text-text-success">{t('default')}</span>
          ) : null}
        </div>

        {showAddressTypes && (
          <div className="flex gap-1">
            {address.tags.map((type) => (
              <span
                key={type}
                className={`text-sm px-2 py-1 rounded-sm 
                              ${type === ADDRESS_TYPE.SHIPPING ? 'bg-surface-information text-text-action-hover' : 'bg-surface-warning text-text-warning'}`}
              >
                {type === ADDRESS_TYPE.SHIPPING ? t('shipping') : type === ADDRESS_TYPE.BILLING ? t('billing') : type}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="text-sm space-y-0.5">
        {address.companyName ? <p>{address.companyName}</p> : null}
        <p>
          {address.street ? <span>{address.street}</span> : null}
          {address.streetNumber ? (
            <span className={address.street ? ' ms-1 tabular-nums' : 'tabular-nums'}>{address.streetNumber}</span>
          ) : null}
        </p>
        {address.streetAppendix ? <p>{address.streetAppendix}</p> : null}
        <p>
          {address.zipCode} {address.city}
        </p>
        {address.state ? <p>{address.state}</p> : null}
        <p>{address.country}</p>
      </div>
    </div>
  );

  const hasContent = flatList.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerElement ? (
          triggerElement
        ) : (
          <Button variant="secondary" className={className}>
            {selectedAddress ? formatAddressSummary(selectedAddress).substring(0, 30) + '...' : t('selectAnAddress')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title || t('selectAnAddress')}</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : hasContent ? (
            <div className="max-h-[400px] overflow-y-auto">{flatList.map(renderAddressBlock)}</div>
          ) : (
            <div className="text-center py-8">{t('noAddresses')}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddressSelectorCustomerBook(props: Omit<AddressSelectorProps, 'addressBook'>) {
  const { addresses, loading } = useAddresses();
  const filtered = filterByAddressRole(addresses, props.addressType);
  return <AddressSelectorInner {...props} flatAddresses={filtered} loading={loading} />;
}

function AddressSelectorLegalEntityBook(props: Omit<AddressSelectorProps, 'addressBook'>) {
  const { addresses, loading } = useLegalEntityCheckoutAddresses();
  const filtered = filterByAddressRole(addresses, props.addressType);
  return <AddressSelectorInner {...props} flatAddresses={filtered} loading={loading} />;
}

/**
 * For logged-in B2B users (businessModel='B2B' with a legalEntityId in the
 * shop session or customer profile) this dispatches to the legal-entity book;
 * for everyone else it dispatches to the customer profile book. Both books are
 * flat — no grouping — so the user always sees addresses of a single origin.
 */
function useIsB2BWithLegalEntity(): boolean {
  const { status } = useSession();
  const { customer } = useCustomer();
  const { session: shopSession } = useShopSession();
  return (
    status === 'authenticated' &&
    customer?.businessModel === 'B2B' &&
    Boolean(resolveLegalEntityIdFromSessionAndCustomer(shopSession, customer))
  );
}

function AddressSelectorAutoBook(props: Omit<AddressSelectorProps, 'addressBook'>) {
  const isB2B = useIsB2BWithLegalEntity();
  if (isB2B) {
    return <AddressSelectorLegalEntityBook {...props} />;
  }
  return <AddressSelectorCustomerBook {...props} />;
}

/**
 * Dialog to pick an address from the customer profile book or the B2B legal-entity location book.
 *
 * @param onSelect - Callback when the user picks a row; receives the {@link Address} and closes the dialog.
 * @param triggerElement - Optional element that opens the dialog (default: secondary button with truncated label or "select address").
 * @param selectedAddressId - Controlled selection id; when set, that row is highlighted and internal selection is not used for that id.
 * @param title - Dialog title override (default: translated "select an address").
 * @param showAddressTypes - When true (default), show SHIPPING/BILLING chips from each address's `tags`.
 * @param addressType - When set, filter to addresses whose `tags` include this role (e.g. checkout shipping passes shipping).
 * @param className - Extra classes on the default trigger button when `triggerElement` is omitted.
 * @param addressBook - See {@link AddressBookMode}. Defaults to `'auto'` which picks the right book based on B2B/B2C context.
 */
export function AddressSelector({ addressBook = 'auto', ...props }: AddressSelectorProps) {
  const { status } = useSession();
  if (status !== 'authenticated') {
    return null;
  }
  if (addressBook === 'legalEntity') {
    return <AddressSelectorLegalEntityBook {...props} />;
  }
  if (addressBook === 'customer') {
    return <AddressSelectorCustomerBook {...props} />;
  }
  return <AddressSelectorAutoBook {...props} />;
}
