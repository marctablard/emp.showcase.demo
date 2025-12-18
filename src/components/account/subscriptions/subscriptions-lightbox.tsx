'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAddresses } from '@/hooks/customer/useAddresses';
import useCustomer from '@/hooks/customer/useCustomer';
import type { Company } from '@/platform/services/model/company/company';
import type { CustomerAddress } from '@/platform/services/model/customer/customer';
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

  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<SubscriptionItem[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [shippingAddressId, setShippingAddressId] = useState('');
  const [interval, setInterval] = useState<SubscriptionInterval>('months');
  const [frequency, setFrequency] = useState(1);
  const [nextOrderDate, setNextOrderDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [active, setActive] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearchQueries, setProductSearchQueries] = useState<Record<number, string>>({});

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

  // Fetch products using ProductService
  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        // Use products API which uses ProductService directly
        const response = await fetch('/api/products?size=10000');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          console.error('Failed to fetch products:', response.status, errorData);
          setProducts([]);
          return;
        }

        const data = await response.json();
        const fetchedProducts = data.items || [];
        console.log('Fetched products from ProductService:', fetchedProducts.length);
        if (fetchedProducts.length > 0) {
          console.log(
            'Sample products:',
            fetchedProducts.slice(0, 3).map((p: Product) => ({
              id: p.id,
              name: typeof p.name === 'string' ? p.name : p.name?.en,
              purchasable: p.purchasable,
            })),
          );
        }
        setProducts(fetchedProducts);
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

  // Helper function to format date to YYYY-MM-DD for HTML date input
  const formatDateForInput = (dateString: string | null | undefined): string => {
    if (!dateString) {
      return new Date().toISOString().split('T')[0];
    }
    // Handle ISO date strings (with or without time)
    if (dateString.includes('T')) {
      return dateString.split('T')[0];
    }
    // Handle date-only strings (YYYY-MM-DD)
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateString;
    }
    // Try to parse and format other date formats
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // Fall through to default
    }
    // Default to today if parsing fails
    return new Date().toISOString().split('T')[0];
  };

  useEffect(() => {
    if (subscription) {
      setItems(subscription.items);
      setCompanyId(subscription.configuration.companyId);
      setShippingAddressId(subscription.configuration.shippingAddressId || '');
      setInterval(subscription.configuration.interval);
      setFrequency(subscription.configuration.frequency);
      // Set next order date - use provided date or default to today
      setNextOrderDate(formatDateForInput(subscription.configuration.nextOrderDate));
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
    // Reset search queries when subscription changes
    setProductSearchQueries({});
  }, [subscription]);

  // Ensure date is always set when dialog opens (fallback)
  useEffect(() => {
    if (open && !nextOrderDate) {
      const today = new Date().toISOString().split('T')[0];
      setNextOrderDate(today);
    }
  }, [open, nextOrderDate]);

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
        nextOrderDate: nextOrderDate || new Date().toISOString().split('T')[0],
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
      console.log('Saving subscription payload:', JSON.stringify(payload, null, 2));
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
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        const errorMessage = errorData.error || 'Failed to save subscription';
        const errorDetails = errorData.details ? `\n\nDetails: ${errorData.details}` : '';
        console.error('Save error:', errorData);
        throw new Error(`${errorMessage}${errorDetails}`);
      }
      onClose(true);
    } catch (e) {
      console.error('Error saving subscription:', e);
      const errorMessage = e instanceof Error ? e.message : 'Failed to save subscription';
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Helper function to format address with truncation
  const formatAddress = (address: CustomerAddress) => {
    const streetPart = address.streetNumber ? `${address.street} ${address.streetNumber}` : address.street;
    const fullAddress = `${address.contactName} - ${streetPart}, ${address.zipCode} ${address.city}`;
    // Truncate to 60 characters max
    if (fullAddress.length > 60) {
      return fullAddress.substring(0, 57) + '...';
    }
    return fullAddress;
  };

  // Helper function to get product display name
  const getProductDisplayName = (product: Product) => {
    const productName = typeof product.name === 'string' ? product.name : product.name?.en || product.id;
    // If it's a variant, show parent info if available
    if (product.parentVariantId) {
      return `${productName} (${t('variant')})`;
    }
    return productName;
  };

  // Filter products based on search query for a specific item index
  const getFilteredProducts = (itemIndex: number): Product[] => {
    const searchQuery = productSearchQueries[itemIndex] || '';
    if (!searchQuery.trim()) {
      return products;
    }
    const query = searchQuery.toLowerCase().trim();
    return products.filter((product: Product) => {
      const productName = getProductDisplayName(product).toLowerCase();
      const productId = product.id.toLowerCase();
      return productName.includes(query) || productId.includes(query);
    });
  };

  const updateProductSearchQuery = (itemIndex: number, query: string) => {
    setProductSearchQueries((prev) => ({
      ...prev,
      [itemIndex]: query,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(openState) => !openState && onClose(false)}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" showCloseButton>
        <DialogHeader>
          <DialogTitle>{subscription ? t('titleEdit') : t('titleCreate')}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="configuration" className="w-full">
          <TabsList
            className={`grid w-full mb-6 ${subscription && subscription.orders.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}
          >
            <TabsTrigger value="configuration">{t('tabConfiguration')}</TabsTrigger>
            <TabsTrigger value="products">{t('tabProducts')}</TabsTrigger>
            {subscription && subscription.orders.length > 0 && (
              <TabsTrigger value="history">{t('tabOrderHistory')}</TabsTrigger>
            )}
          </TabsList>

          {/* Configuration Tab */}
          <TabsContent value="configuration" className="space-y-6" style={{ minHeight: '500px' }}>
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
                          {formatAddress(address)}
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
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4" style={{ minHeight: '500px' }}>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium">{t('products')}</label>
              <Button variant="secondary" size="small" onClick={handleAddItem}>
                {t('addProduct')}
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => {
                const filteredProducts = getFilteredProducts(index);
                const searchQuery = productSearchQueries[index] || '';

                return (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select
                        value={item.productId || ''}
                        onValueChange={(value) => {
                          handleUpdateItem(index, { productId: value });
                          // Clear search when product is selected
                          updateProductSearchQuery(index, '');
                        }}
                        disabled={loadingProducts}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('product')} />
                        </SelectTrigger>
                        <SelectContent className="p-0">
                          {/* Search input inside dropdown */}
                          <div className="sticky top-0 z-10 border-b border-border-primary bg-surface-page p-2">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-placeholders" />
                              <Input
                                type="text"
                                placeholder={t('searchProducts')}
                                value={searchQuery}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateProductSearchQuery(index, e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                className="pl-8 h-9 text-sm"
                              />
                            </div>
                          </div>
                          {/* Product list */}
                          <div className="max-h-[300px] overflow-y-auto">
                            {loadingProducts ? (
                              <div className="px-3 py-2 text-sm text-text-secondary">{t('loadingProducts')}</div>
                            ) : products.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-text-secondary">{t('noProductsFound')}</div>
                            ) : filteredProducts.length > 0 ? (
                              filteredProducts.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {getProductDisplayName(product)}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-sm text-text-secondary">
                                {searchQuery ? t('noProductsFound') : t('loadingProducts')}
                              </div>
                            )}
                          </div>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(index, { quantity: Number(e.target.value) || 1 })}
                        aria-label={t('quantity')}
                        placeholder={t('quantity')}
                      />
                    </div>
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => {
                        handleRemoveItem(index);
                        // Clean up search query when item is removed
                        const newQueries = { ...productSearchQueries };
                        delete newQueries[index];
                        setProductSearchQueries(newQueries);
                      }}
                      aria-label={t('removeProduct')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              {items.length === 0 && <p className="text-sm text-text-secondary py-2">{t('addProduct')}</p>}
            </div>
          </TabsContent>

          {/* Order History Tab */}
          {subscription && subscription.orders.length > 0 && (
            <TabsContent value="history" className="space-y-4" style={{ minHeight: '500px' }}>
              <label className="block text-sm font-medium mb-2">{t('orderHistory')}</label>
              <div className="space-y-2">
                {subscription.orders.map((order, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center text-sm py-2 border-b border-border-default last:border-0"
                  >
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
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter className="!flex-row !justify-end items-center w-full">
          <Button onClick={handleSave} disabled={saving || !companyId || !customer?.id}>
            {saving ? t('save') + '...' : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
