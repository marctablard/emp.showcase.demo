'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CheckedState } from '@radix-ui/react-checkbox';
import { isEqual, omit } from 'lodash';
import AddressForm from '@/components/common/address-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Address } from '@/platform/services/model/common';

interface CheckoutAddressProps {
  address?: Address | null;
  addressLabel: string;
  isReadOnly?: boolean;
  sameAs?: {
    referenceAddress: Address;
    label: string;
    id: string;
  };
  onAddressChange?: (address: Address) => void;
  /** Prefix for data-testid attributes on the address form fields */
  testIdPrefix?: string;
}

/**
 * Addresses component for checkout
 * Manages both shipping and billing addresses with option to use same address for both
 */
const CheckoutAddress: React.FC<CheckoutAddressProps> = ({
  address,
  isReadOnly = false,
  sameAs,
  onAddressChange,
  testIdPrefix = 'address',
}) => {
  const form = useForm();
  // Determine if billing is same as shipping based on actual address comparison
  const initialSameState = useMemo(() => {
    if (!sameAs) return false;
    return isEqual(omit(address, 'type'), omit(sameAs.referenceAddress, 'type'));
  }, [address, sameAs]);

  const [isSame, setIsSame] = useState<boolean>(initialSameState);

  useEffect(() => {
    if (!sameAs || !address) return;
    setIsSame(initialSameState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, sameAs]);

  const handleSameAddressToggle = (checked: CheckedState) => {
    setIsSame(checked.valueOf() as boolean);
    if (checked && sameAs && onAddressChange) {
      onAddressChange(sameAs.referenceAddress);
    }
  };

  return (
    <Form {...form}>
      <div className="space-y-8 bg-surface-page pb-6 border-b border-border-primary">
        {/* Same as ... checkbox */}
        {sameAs && (
          <FormField
            name="sameAs"
            render={() => (
              <FormItem className="flex flex-row items-center gap-2">
                <FormControl>
                  <Checkbox
                    checked={isSame}
                    onCheckedChange={handleSameAddressToggle}
                    data-testid={`${testIdPrefix}-sameAsCheckbox`}
                  />
                </FormControl>
                <FormLabel className="font-medium">{sameAs.label}</FormLabel>
              </FormItem>
            )}
          />
        )}

        {/* Address Input (only shown if not same as referenceAddress) */}
        {!isSame && (
          <div>
            <AddressForm
              initialData={address}
              onDataChange={onAddressChange}
              isReadOnly={isReadOnly}
              testIdPrefix={testIdPrefix}
            />
          </div>
        )}
      </div>
    </Form>
  );
};

export default CheckoutAddress;
