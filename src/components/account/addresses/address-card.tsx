'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Edit, Plus, Trash } from 'lucide-react';
import { AddressDisplay } from '@/components/common/address-display';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { H1 } from '@/components/ui/h';
import { Spinner } from '@/components/ui/spinner';
import { useAddresses } from '@/hooks/customer/useAddresses';
import { useToast } from '@/hooks/ui/useToast';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Address, AddressType } from '@/platform/services/model/common';
import type { CustomerAddress } from '@/platform/services/model/customer/customer';
import { AddressDialog } from './address-dialog';

interface AddressCardProps {
  address: CustomerAddress;
  isDeleting?: boolean;
  onEdit?: (address: Address) => void;
  onDelete?: (address: Address) => void;
}

/**
 * Individual address card component
 */
export function AddressCard({ address, isDeleting = false, onEdit, onDelete }: AddressCardProps) {
  const t = useTranslations('account');
  const showDefaultBadge = address.source === 'customer' && address.isDefault === true;
  const showActions = Boolean(onEdit || onDelete);

  return (
    <Card className="h-full min-w-0 overflow-hidden">
      <CardHeader className="min-w-0 gap-3 pb-2">
        <CardTitle className="min-w-0 text-lg font-medium break-all">{address.contactName}</CardTitle>
        {showDefaultBadge || showActions ? (
          <CardAction className="flex items-center gap-4">
            {showDefaultBadge ? (
              <Badge variant="outline" rounded="default" className="bg-surface-success text-text-success">
                {t('Address.default')}
              </Badge>
            ) : null}
            {showActions ? (
              <div className="flex items-center gap-2">
                {onEdit && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(address)}
                    aria-label={t('Address.editAddress')}
                    data-testid={`accountAddress-edit-${address.id}`}
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
                    data-testid={`accountAddress-delete-${address.id}`}
                  >
                    {isDeleting ? <Spinner variant="sm" /> : <Trash className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            ) : null}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="min-w-0">
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
        <Button
          variant="secondary"
          onClick={() => fetchAddresses()}
          className="mt-4"
          data-testid="accountAddress-retryButton"
        >
          {t('tryAgain')}
        </Button>
      </div>
    );
  }

  if (!addresses || addresses.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-text-placeholders">{t('Address.noAddresses')}</p>
        <Button onClick={() => setIsDialogOpen(true)} className="mt-4" data-testid="accountAddress-addButton">
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
        <Button onClick={() => setIsDialogOpen(true)} data-testid="accountAddress-addButton">
          <Plus className="mr-2 h-4 w-4" />
          {t('Address.addNewAddress')}
        </Button>
      </div>

      {addresses.filter((address) => address.tags.includes(type)).length === 0 ? (
        <div className="text-center py-8">
          <p className="text-text-placeholders">
            {type === 'SHIPPING' ? t('Address.noShippingAddresses') : t('Address.noBillingAddresses')}
          </p>
          <Button onClick={() => setIsDialogOpen(true)} className="mt-4" data-testid="accountAddress-addButton">
            <Plus className="mr-2 h-4 w-4" />
            {t('Address.addNewAddress')}
          </Button>
        </div>
      ) : (
        <div className="@container min-w-0">
          <div className="address-cards-grid" data-slot="address-cards-grid">
            {addresses
              .filter((address) => address.tags.includes(type))
              .map((address: CustomerAddress) => {
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
