'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import AddressForm from '@/components/common/address-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAddresses } from '@/hooks/customer/useAddresses';
import { getLogger } from '@/lib/logger/use-logger-client';
import { Address, AddressType } from '@/platform/services/model/common';
import { CustomerAddress } from '@/platform/services/model/customer/customer';

interface AddressDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (address: Partial<CustomerAddress>) => void;
  initialData?: Address;
  addressType?: AddressType;
  title?: string;
}

/**
 * Dialog for adding or editing addresses
 */
export function AddressDialog({
  isOpen,
  onOpenChange,
  onSave,
  initialData,
  addressType = 'SHIPPING',
  title,
}: AddressDialogProps) {
  const t = useTranslations('account');
  const [formData, setFormData] = useState<Address | undefined>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const { createAddress, updateAddress } = useAddresses();

  // Handle save button click
  const handleSave = async () => {
    if (!formData) return;
    setIsSaving(true);
    try {
      // If we have an id, we're updating an existing address
      const addressId = initialData?.id;
      if (addressId) {
        const updatedAddress = await updateAddress(addressId, {
          ...formData,
          tags: [addressType],
        });
        if (onSave) onSave(updatedAddress);
      } else {
        // Otherwise create a new address
        const newAddress = await createAddress({
          ...formData,
          tags: [addressType],
        });
        if (onSave) onSave(newAddress);
      }
      onOpenChange(false);
    } catch (error) {
      getLogger().error({ err: error }, 'Failed to save address');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {title || (addressType === 'SHIPPING' ? t('Address.addShippingAddress') : t('Address.addBillingAddress'))}
          </DialogTitle>
          <DialogDescription>{t('Address.addressFormDescription')}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <AddressForm initialData={initialData} onDataChange={setFormData} testIdPrefix="accountAddress" />
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            data-testid="accountAddress-cancelButton"
          >
            {t('Address.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving} data-testid="accountAddress-saveButton">
            {isSaving ? t('Address.saving') : t('Address.saveAddress')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
