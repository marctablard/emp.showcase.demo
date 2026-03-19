'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Edit, Plus, Trash } from 'lucide-react';
import { AddressDisplay } from '@/components/common/address-display';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { H1 } from '@/components/ui/h';
import { Spinner } from '@/components/ui/spinner';
import { useAddresses } from '@/hooks/customer/useAddresses';
import { useToast } from '@/hooks/ui/useToast';
import { getLogger } from '@/lib/logger/use-logger-client';
import { Address, AddressType } from '@/platform/services/model/common';
import { AddressDialog } from './address-dialog';

interface AddressCardProps {
  address: Address;
  isDeleting?: boolean;
  onEdit?: (address: Address) => void;
  onDelete?: (address: Address) => void;
}

/**
 * Individual address card component
 */
export function AddressCard({ address, isDeleting = false, onEdit, onDelete }: AddressCardProps) {
  const t = useTranslations('account');

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-medium">
            {address.contactName}
            {address.isDefault && (
              <Badge variant="secondary" className="ml-2">
                {t('Address.default')}
              </Badge>
            )}
          </CardTitle>
          <div className="flex space-x-2">
            {onEdit && (
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(address)}
                aria-label={t('Address.editAddress')}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDelete(address)}
                disabled={isDeleting}
                aria-label={t('Address.deleteAddress')}
              >
                {isDeleting ? <Spinner variant="sm" /> : <Trash className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <AddressDisplay address={address} />
      </CardContent>
    </Card>
  );
}

/**
 * Addresses list component
 * Displays all shipping addresses for a customer
 */
export function AddressesList({ type = 'SHIPPING' as AddressType }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<Address | null>(null);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);
  const t = useTranslations('account');
  const { toast } = useToast();
  const { addresses, loading, error, fetchAddresses, deleteAddress } = useAddresses();

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-text-error">{t('Address.errorLoadingAddresses')}</p>
        <Button variant="secondary" onClick={() => fetchAddresses()} className="mt-4">
          {t('tryAgain')}
        </Button>
      </div>
    );
  }

  if (!addresses || addresses.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-text-placeholders">{t('Address.noAddresses')}</p>
        <Button onClick={() => setIsDialogOpen(true)} className="mt-4">
          <Plus className="mr-2 h-4 w-4" />
          {t('Address.addNewAddress')}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <H1>{type === 'SHIPPING' ? t('Address.shippingAddresses') : t('Address.billingAddresses')}</H1>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('Address.addNewAddress')}
        </Button>
      </div>

      {addresses.filter((address) => address.tags.includes(type)).length === 0 ? (
        <div className="text-center py-8">
          <p className="text-text-placeholders">
            {type === 'SHIPPING' ? t('Address.noShippingAddresses') : t('Address.noBillingAddresses')}
          </p>
          <Button onClick={() => setIsDialogOpen(true)} className="mt-4">
            <Plus className="mr-2 h-4 w-4" />
            {t('Address.addNewAddress')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {addresses
            .filter((address) => address.tags.includes(type))
            .map((address: Address) => {
              return (
                <AddressCard
                  key={address.id || `${address.contactName}-${address.street}-${address.city}`}
                  address={address}
                  isDeleting={deletingAddressId === address.id}
                  onEdit={(addr) => {
                    // Öffnet den Dialog im Bearbeitungsmodus
                    setCurrentAddress(addr);
                    setIsDialogOpen(true);
                  }}
                  onDelete={async (address) => {
                    if (window.confirm(t('confirmDeleteAddress'))) {
                      try {
                        const addressId = address.id;
                        if (addressId) {
                          setDeletingAddressId(addressId);

                          await deleteAddress(addressId);
                          // Die Adressliste wird automatisch durch den Hook aktualisiert
                          toast({
                            title: t('Address.success'),
                            description: t('Address.addressDeleted'),
                            variant: 'success',
                          });
                        }
                      } catch (error) {
                        getLogger().error({ err: error }, 'Error deleting address');
                        toast({
                          title: t('Address.error'),
                          description: t('Address.errorDeletingAddress'),
                          variant: 'destructive',
                        });
                      } finally {
                        setDeletingAddressId(null);
                      }
                    }
                  }}
                />
              );
            })}
        </div>
      )}

      {/* Render the dialog in a single place */}
      <AddressDialog
        isOpen={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            // Dialog wurde geschlossen, Adresse zurücksetzen
            setCurrentAddress(null);
          }
        }}
        addressType={type}
        initialData={currentAddress || undefined}
        title={
          currentAddress
            ? t('Address.editAddress')
            : type === 'SHIPPING'
              ? t('Address.addShippingAddress')
              : t('Address.addBillingAddress')
        }
        onSave={(savedAddress) => {
          getLogger().debug({ savedAddress }, 'Address saved');
          fetchAddresses();
        }}
      />
    </div>
  );
}
