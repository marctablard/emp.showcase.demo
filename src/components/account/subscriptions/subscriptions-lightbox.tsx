'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Ban, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAddresses } from '@/hooks/customer/useAddresses';
import useCustomer from '@/hooks/customer/useCustomer';
import type { Company } from '@/platform/services/model/company/company';
import type { Product } from '@/platform/services/model/product';
import type {
  Subscription,
  SubscriptionInterval,
  SubscriptionItem,
  SubscriptionUpsertRequest,
} from '@/platform/services/subscription/SubscriptionService';

interface SubscriptionsLightboxProps {
  subscription: Subscription | null;
  open: boolean;
  onClose: (changed?: boolean) => void;
}

export function SubscriptionsLightbox({ subscription, open, onClose }: SubscriptionsLightboxProps) {
  const t = useTranslations('account.Subscriptions.lightbox');
  const { customer } = useCustomer();
  const { addresses } = useAddresses();
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<SubscriptionItem[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [shippingAddressId, setShippingAddressId] = useState('');
  const [interval, setInterval] = useState<SubscriptionInterval>('months');
  const [frequency, setFrequency] = useState(1);
  const [nextOrderDate, setNextOrderDate] = useState('');
  const [active, setActive] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Fetch companies for the customer
  useEffect(() => {
    const fetchCompanies = async () => {
      if (!customer?.legalEntityId) {
        setCompanies([]);
        return;
      }
      setLoadingCompanies(true);
      try {
        // For now, fetch the current company. In a real scenario, you'd fetch all companies the customer belongs to
        const response = await fetch('/api/company/current');
        if (response.ok) {
          const company = await response.json();
          setCompanies(company ? [company] : []);
        } else {
          setCompanies([]);
        }
      } catch (error) {
        console.error('Error fetching companies:', error);
        setCompanies([]);
      } finally {
        setLoadingCompanies(false);
      }
    };
    if (open && customer) {
      fetchCompanies();
    }
  }, [open, customer]);

  // Fetch products (excluding variants)
  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        // Fetch products using search API, filtering out variants
        const response = await fetch('/api/search?size=1000');
        if (response.ok) {
          const data = await response.json();
          // Filter out variants (products with parentVariantId)
          const nonVariantProducts = (data.items || []).filter(
            (product: Product) => !product.parentVariantId && product.purchasable,
          );
          setProducts(nonVariantProducts);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
        setProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };
    if (open) {
      fetchProducts();
    }
  }, [open]);

  useEffect(() => {
    if (subscription) {
      setItems(subscription.items);
      setCompanyId(subscription.configuration.companyId);
      setShippingAddressId(subscription.configuration.shippingAddressId || '');
      setInterval(subscription.configuration.interval);
      setFrequency(subscription.configuration.frequency);
      // Set next order date to today if empty
      const nextDate =
        subscription.configuration.nextOrderDate?.split('T')[0] || new Date().toISOString().split('T')[0];
      setNextOrderDate(nextDate);
      setActive(subscription.configuration.active);
    } else {
      setItems([]);
      setCompanyId('');
      setShippingAddressId('');
      setInterval('months');
      setFrequency(1);
      // Set next order date to today for new subscriptions
      setNextOrderDate(new Date().toISOString().split('T')[0]);
      setActive(true);
    }
  }, [subscription]);

  const handleAddItem = () => {
    setItems((prev) => [...prev, { productId: '', quantity: 1 }]);
  };

  const handleUpdateItem = (index: number, patch: Partial<SubscriptionItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const buildPayload = (): SubscriptionUpsertRequest => {
    const customerId = subscription?.configuration.customerId || customer?.id || '';

    return {
      id: subscription?.id,
      name: subscription?.name,
      items: items.filter((item) => item.productId && item.quantity > 0),
      configuration: {
        active,
        companyId,
        customerId,
        dateCreated: subscription?.configuration.dateCreated,
        endDate: subscription?.configuration.endDate ?? null,
        frequency,
        interval,
        lastOrderDate: subscription?.configuration.lastOrderDate ?? null,
        nextOrderDate: nextOrderDate || subscription?.configuration.nextOrderDate,
        notificationDate: subscription?.configuration.notificationDate ?? null,
        paymentMethod: 'INVOICE',
        shippingAddressId: shippingAddressId || subscription?.configuration.shippingAddressId,
      },
    };
  };

  const handleSave = async () => {
    if (!companyId || !customer?.id) {
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      const method = subscription ? 'PUT' : 'POST';
      const url = subscription ? `/api/subscriptions/${subscription.id}` : '/api/subscriptions';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save subscription');
      }
      onClose(true);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Failed to save subscription');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription?.id) {
      return;
    }

    if (!confirm(t('cancelSubscription') + '?')) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/subscriptions/${subscription.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'cancel' }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }
      onClose(true);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Failed to cancel subscription');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(openState) => !openState && onClose(false)}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" showCloseButton>
        <DialogHeader>
          <DialogTitle>{subscription ? t('titleEdit') : t('titleCreate')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Company and Address */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('company')}</label>
              <Select value={companyId || ''} onValueChange={setCompanyId} disabled={loadingCompanies}>
                <SelectTrigger>
                  <SelectValue placeholder={t('company')} />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('address')}</label>
              <Select value={shippingAddressId || ''} onValueChange={setShippingAddressId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('address')} />
                </SelectTrigger>
                <SelectContent>
                  {addresses
                    ?.filter((addr) => addr.types.includes('SHIPPING'))
                    .map((address) => (
                      <SelectItem key={address.id} value={address.id || ''}>
                        {address.contactName} - {address.street} {address.streetNumber}, {address.zipCode}{' '}
                        {address.city}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Frequency and Interval */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('frequency')}</label>
              <Input
                type="number"
                min={1}
                value={frequency}
                onChange={(e) => setFrequency(Number(e.target.value) || 1)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('interval')}</label>
              <Select value={interval} onValueChange={(value) => setInterval(value as SubscriptionInterval)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">{t('intervalDays')}</SelectItem>
                  <SelectItem value="weeks">{t('intervalWeeks')}</SelectItem>
                  <SelectItem value="months">{t('intervalMonths')}</SelectItem>
                  <SelectItem value="years">{t('intervalYears')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Next Order Date */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('nextOrderDate')}</label>
            <Input type="date" value={nextOrderDate} onChange={(e) => setNextOrderDate(e.target.value)} />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('paymentMethod')}</label>
            <Select value="INVOICE" disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INVOICE">{t('paymentMethodInvoice')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Products */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">{t('products')}</label>
              <Button variant="secondary" size="small" onClick={handleAddItem}>
                {t('addProduct')}
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-[2fr,1fr,auto] gap-2 items-center">
                  <Select
                    value={item.productId || ''}
                    onValueChange={(value) => handleUpdateItem(index, { productId: value })}
                    disabled={loadingProducts}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('product')} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => {
                        const productName =
                          typeof product.name === 'string' ? product.name : product.name?.en || product.id;
                        return (
                          <SelectItem key={product.id} value={product.id}>
                            {productName}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => handleUpdateItem(index, { quantity: Number(e.target.value) || 1 })}
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => handleRemoveItem(index)}
                    aria-label={t('removeProduct')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {items.length === 0 && <p className="text-sm text-text-secondary py-2">{t('addProduct')}</p>}
            </div>
          </div>

          {/* Read-only information for existing subscriptions */}
          {subscription && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium mb-1">{t('dateCreated')}</label>
                <p className="text-sm text-text-secondary">
                  {subscription.configuration.dateCreated
                    ? new Date(subscription.configuration.dateCreated).toLocaleDateString()
                    : '-'}
                </p>
              </div>
              {subscription.configuration.lastOrderDate && (
                <div>
                  <label className="block text-sm font-medium mb-1">{t('lastOrderDate')}</label>
                  <p className="text-sm text-text-secondary">
                    {new Date(subscription.configuration.lastOrderDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {subscription.configuration.notificationDate && (
                <div>
                  <label className="block text-sm font-medium mb-1">{t('notificationDate')}</label>
                  <p className="text-sm text-text-secondary">
                    {new Date(subscription.configuration.notificationDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {subscription.configuration.endDate && (
                <div>
                  <label className="block text-sm font-medium mb-1">{t('endDate')}</label>
                  <p className="text-sm text-text-secondary">
                    {new Date(subscription.configuration.endDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">{t('status')}</label>
                <p className="text-sm text-text-secondary">
                  {subscription.configuration.active
                    ? t('statusActive')
                    : subscription.configuration.endDate
                      ? t('statusCancelled')
                      : t('statusPaused')}
                </p>
              </div>
            </div>
          )}

          {/* Order History */}
          {subscription && subscription.orders.length > 0 && (
            <div className="pt-4 border-t">
              <label className="block text-sm font-medium mb-2">{t('orderHistory')}</label>
              <div className="space-y-1">
                {subscription.orders.map((order, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <UiLink
                      type="Link"
                      href={`/account/orders/${order.orderId}`}
                      variant="primary"
                      size="m"
                      className="hover:underline"
                    >
                      {t('order')} {order.orderId}
                    </UiLink>
                    <span className="text-text-secondary">
                      {order.date ? new Date(order.date).toLocaleDateString() : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="!flex-row !justify-between items-center w-full">
          <div>
            {subscription && !subscription.configuration.endDate && (
              <Button
                variant="red"
                onClick={handleCancelSubscription}
                disabled={saving}
                iconBefore={<Ban className="h-4 w-4" />}
              >
                {t('cancelSubscription')}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onClose(false)} disabled={saving}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving || !companyId || !customer?.id}>
              {saving ? t('save') + '...' : t('save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
