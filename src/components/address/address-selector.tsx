'use client';

import React, { ReactNode, useState } from 'react';
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
import { Address, AddressType } from '@/platform/services/model/common';
import { CustomerAddress } from '@/platform/services/model/customer/customer';

export type AddressBookMode = 'customer' | 'legalEntity' | 'companyAndCustomer';

export interface AddressSelectorProps {
  onSelect: (address: Address) => void;
  triggerElement?: ReactNode;
  selectedAddressId?: string;
  title?: string;
  showAddressTypes?: boolean;
  addressType?: AddressType;
  className?: string;
  /**
   * `customer` — profile addresses only.
   * `legalEntity` — legal-entity locations only (B2B).
   * `companyAndCustomer` — both, in two sections; company section only for logged-in B2B users with a legal entity.
   */
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

interface GroupedLists {
  showCompanyRow: boolean;
  companyAddresses: CustomerAddress[];
  customerAddresses: CustomerAddress[];
}

interface AddressSelectorInnerProps extends Omit<AddressSelectorProps, 'addressBook'> {
  grouped: GroupedLists | null;
  /** Used when `grouped` is null */
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
  grouped,
  flatAddresses,
  loading,
}: AddressSelectorInnerProps) {
  const t = useTranslations('account.AddressForm');
  const tCheckout = useTranslations('checkout');
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

  const flatList = grouped
    ? [...(grouped.showCompanyRow ? grouped.companyAddresses : []), ...grouped.customerAddresses]
    : (flatAddresses ?? []);

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
        <p className="font-bold">{address.contactName}</p>

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

      {address.isDefault && (
        <div className="w-fit text-sm px-2 py-1 rounded-sm bg-surface-success text-text-body mt-1">{t('default')}</div>
      )}
    </div>
  );

  const hasGroupedContent =
    grouped &&
    ((grouped.showCompanyRow && grouped.companyAddresses.length > 0) || grouped.customerAddresses.length > 0);

  const hasFlatContent = !grouped && flatAddresses && flatAddresses.length > 0;

  const showList = hasGroupedContent || hasFlatContent;

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
          ) : showList ? (
            <div className="max-h-[400px] overflow-y-auto space-y-4">
              {grouped && grouped.showCompanyRow && grouped.companyAddresses.length > 0 ? (
                <div>
                  <p className="text-sm font-semibold text-text-body mb-2">
                    {tCheckout('addressBook.companyAddresses')}
                  </p>
                  <div>{grouped.companyAddresses.map(renderAddressBlock)}</div>
                </div>
              ) : null}
              {grouped && grouped.customerAddresses.length > 0 ? (
                <div>
                  <p className="text-sm font-semibold text-text-body mb-2">
                    {tCheckout('addressBook.customerAddresses')}
                  </p>
                  <div>{grouped.customerAddresses.map(renderAddressBlock)}</div>
                </div>
              ) : null}
              {!grouped && flatAddresses?.length ? flatAddresses.map(renderAddressBlock) : null}
            </div>
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
  return <AddressSelectorInner {...props} grouped={null} flatAddresses={filtered} loading={loading} />;
}

function AddressSelectorLegalEntityBook(props: Omit<AddressSelectorProps, 'addressBook'>) {
  const { addresses, loading } = useLegalEntityCheckoutAddresses();
  const filtered = filterByAddressRole(addresses, props.addressType);
  return <AddressSelectorInner {...props} grouped={null} flatAddresses={filtered} loading={loading} />;
}

function AddressSelectorCompanyAndCustomerBook(props: Omit<AddressSelectorProps, 'addressBook'>) {
  const { status } = useSession();
  const { customer } = useCustomer();
  const { session: shopSession } = useShopSession();

  const showCompanyRow =
    status === 'authenticated' &&
    customer?.businessModel === 'B2B' &&
    Boolean(resolveLegalEntityIdFromSessionAndCustomer(shopSession, customer));

  const { addresses: leAddresses, loading: leLoading } = useLegalEntityCheckoutAddresses(!showCompanyRow);
  const { addresses: customerAddresses, loading: custLoading } = useAddresses();

  const companyFiltered = filterByAddressRole(showCompanyRow ? leAddresses : [], props.addressType);
  const customerFiltered = filterByAddressRole(customerAddresses, props.addressType);

  const loading = custLoading || (showCompanyRow && leLoading);

  if (!loading && companyFiltered.length === 0 && customerFiltered.length === 0) {
    return null;
  }

  return (
    <AddressSelectorInner
      {...props}
      grouped={{
        showCompanyRow,
        companyAddresses: companyFiltered,
        customerAddresses: customerFiltered,
      }}
      flatAddresses={undefined}
      loading={loading}
    />
  );
}

/**
 * Dialog to pick an address from the customer profile book, the B2B legal-entity location book, or both (grouped).
 *
 * @param onSelect - Callback when the user picks a row; receives the {@link Address} and closes the dialog.
 * @param triggerElement - Optional element that opens the dialog (default: secondary button with truncated label or “select address”).
 * @param selectedAddressId - Controlled selection id; when set, that row is highlighted and internal selection is not used for that id.
 * @param title - Dialog title override (default: translated “select an address”).
 * @param showAddressTypes - When true (default), show SHIPPING/BILLING chips from each address’s `tags`.
 * @param addressType - When set, filter to addresses whose `tags` include this role (e.g. checkout shipping passes shipping).
 * @param className - Extra classes on the default trigger button when `triggerElement` is omitted.
 * @param addressBook - `customer`: profile addresses. `legalEntity`: B2B locations. `companyAndCustomer`: both sections for checkout (company row only when logged-in B2B with legal entity).
 */
export function AddressSelector({ addressBook = 'customer', ...props }: AddressSelectorProps) {
  if (addressBook === 'legalEntity') {
    return <AddressSelectorLegalEntityBook {...props} />;
  }
  if (addressBook === 'companyAndCustomer') {
    return <AddressSelectorCompanyAndCustomerBook {...props} />;
  }
  return <AddressSelectorCustomerBook {...props} />;
}
