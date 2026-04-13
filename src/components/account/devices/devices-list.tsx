'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { Activity, ChevronsUpDown, Layers, Search } from 'lucide-react';
import { DashboardCard } from '@/components/account/dashboard/cards/dashboard-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { H4 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCustomer } from '@/hooks/customer/useCustomer';
import { useDevices } from '@/hooks/device/useDevices';
import { useProducts } from '@/hooks/product/useProducts';
import { useL10n } from '@/hooks/useL10n';
import { cn } from '@/lib/utils';
import type { Device } from '@/types/device';
import { HealthMonitorModal } from './health-monitor-modal';
import { RelatedProductsModal } from './related-products-modal';

type DeviceSortField = 'productName' | 'serialNumber' | 'health';

interface DevicesListProps {
  initialDevices?: Device[];
}

function getHealthBadgeVariant(health: string): 'success' | 'warning' | 'default' {
  const value = Number(health);
  if (value >= 70) return 'success';
  if (value >= 30) return 'warning';
  return 'default';
}

export function DevicesList({ initialDevices }: DevicesListProps) {
  const t = useTranslations('account.devices');
  const locale = useLocale();
  const { l10n } = useL10n(locale);
  const [sortField, setSortField] = useState<DeviceSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [healthDevice, setHealthDevice] = useState<Device | null>(null);
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { customer } = useCustomer();

  const { devices, loading, error, refreshDevices } = useDevices(initialDevices);

  const productIds = useMemo(() => {
    return devices.map((device) => device.productId).filter(Boolean) as string[];
  }, [devices]);

  const { products, loading: productsLoading } = useProducts(productIds, { prices: false });

  const productMap = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      map.set(product.id, product);
    });
    return map;
  }, [products]);

  const filteredDevices = useMemo(() => {
    if (!searchQuery.trim()) return devices;
    const q = searchQuery.toLowerCase();
    return devices.filter((device) => {
      const product = productMap.get(device.productId);
      const name = product ? l10n(product.name).toLowerCase() : '';
      return (
        name.includes(q) || device.serialNumber.toLowerCase().includes(q) || device.health.toLowerCase().includes(q)
      );
    });
  }, [devices, searchQuery, productMap, l10n]);

  const sortedDevices = [...filteredDevices].sort((a, b) => {
    if (!sortField) return 0;
    let comparison = 0;
    switch (sortField) {
      case 'productName': {
        const nameA = productMap.get(a.productId) ? l10n(productMap.get(a.productId).name) : '';
        const nameB = productMap.get(b.productId) ? l10n(productMap.get(b.productId).name) : '';
        comparison = nameA.localeCompare(nameB);
        break;
      }
      case 'serialNumber':
        comparison = a.serialNumber.localeCompare(b.serialNumber);
        break;
      case 'health':
        comparison = Number(a.health || 0) - Number(b.health || 0);
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const toggleSort = (field: DeviceSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleViewRelatedProducts = (device: Device) => {
    const product = productMap.get(device.productId);
    if (product?.relatedItems && product.relatedItems.length > 0) {
      setSelectedDevice(device);
      setModalOpen(true);
    }
  };

  const handleOpenHealthMonitor = (device: Device) => {
    setHealthDevice(device);
    setHealthModalOpen(true);
  };

  const selectedProduct = selectedDevice ? productMap.get(selectedDevice.productId) : null;
  const healthProduct = healthDevice ? productMap.get(healthDevice.productId) : null;
  const colSpan = 4;

  return (
    <>
      <DashboardCard variant="default" className="py-4 pb-0">
        <div className="flex items-center justify-between mb-4">
          <CardTitle>
            <H4>{t('title')}</H4>
          </CardTitle>
        </div>

        <div className="mb-4 w-[60%]">
          <Input
            placeholder={t('searchPlaceholder')}
            endIcon={Search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-col">
          <Table>
            <TableHeader>
              <TableRow className="text-base">
                <TableHead className="font-bold">
                  <button
                    onClick={() => toggleSort('productName')}
                    className="flex items-center gap-1 hover:text-text-action"
                  >
                    {t('columnProductName')}
                    <ChevronsUpDown className="h-4 w-4" />
                  </button>
                </TableHead>
                <TableHead className="font-bold">
                  <button
                    onClick={() => toggleSort('serialNumber')}
                    className="flex items-center gap-1 hover:text-text-action"
                  >
                    {t('columnSerialNumber')}
                    <ChevronsUpDown className="h-4 w-4" />
                  </button>
                </TableHead>
                <TableHead className="font-bold">
                  <button
                    onClick={() => toggleSort('health')}
                    className="flex items-center gap-1 hover:text-text-action"
                  >
                    {t('columnHealth')}
                    <ChevronsUpDown className="h-4 w-4" />
                  </button>
                </TableHead>
                <TableHead className="font-bold text-right">{t('columnActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || productsLoading ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Spinner color="primary" variant="md" />
                      <span>{t('loading')}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-6">
                    <div className="text-text-error mb-2">
                      {t('errorLoading')}: {error.message}
                    </div>
                    <Button variant="neutral" size="small" onClick={() => refreshDevices()}>
                      {t('tryAgain')}
                    </Button>
                  </TableCell>
                </TableRow>
              ) : sortedDevices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-6 text-text-placeholders">
                    {t('noDevices')}
                  </TableCell>
                </TableRow>
              ) : (
                sortedDevices.map((device, index) => {
                  const product = productMap.get(device.productId);
                  const hasRelatedProducts = product?.relatedItems && product.relatedItems.length > 0;

                  return (
                    <TableRow
                      key={device.id}
                      className={cn(
                        'hover:bg-surface-image-background text-base',
                        index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
                      )}
                    >
                      <TableCell className="px-2 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-sm bg-surface-image-background">
                            {product?.images && product.images.length > 0 ? (
                              <Image
                                src={product.images[0].url}
                                alt={product.images[0].altText ? l10n(product.images[0].altText) : l10n(product.name)}
                                fill
                                className="object-contain"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Image src="/images/no_image_alt.png" alt="" width={24} height={24} />
                              </div>
                            )}
                          </div>
                          {product ? (
                            <UiLink type="Link" href={`/product/${device.productId}`} variant="primary" size="m">
                              {l10n(product.name)}
                            </UiLink>
                          ) : (
                            <span className="text-text-placeholders">{device.productId || t('unknownProduct')}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-4">{device.serialNumber}</TableCell>
                      <TableCell className="px-2 py-4">
                        <Badge variant={getHealthBadgeVariant(device.health)}>{device.health}%</Badge>
                      </TableCell>
                      <TableCell className="px-2 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {hasRelatedProducts ? (
                            <Button
                              variant="link"
                              size="icon"
                              onClick={() => handleViewRelatedProducts(device)}
                              title={t('viewRelatedProducts')}
                            >
                              <Layers className="h-5 w-5" />
                            </Button>
                          ) : (
                            <span className="text-text-placeholders text-sm mr-2">{t('noRelatedProducts')}</span>
                          )}
                          <Button
                            variant="link"
                            size="icon"
                            onClick={() => handleOpenHealthMonitor(device)}
                            title={t('viewHealthMonitor')}
                          >
                            <Activity className="h-5 w-5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DashboardCard>

      {selectedDevice && selectedProduct?.relatedItems && (
        <RelatedProductsModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          relatedItems={selectedProduct.relatedItems}
          locale={locale}
          deviceName={l10n(selectedDevice.name)}
        />
      )}

      {healthDevice && (
        <HealthMonitorModal
          open={healthModalOpen}
          onOpenChange={setHealthModalOpen}
          device={healthDevice}
          product={healthProduct ?? null}
          productName={healthProduct ? l10n(healthProduct.name) : l10n(healthDevice.name)}
          customerId={customer?.id ?? ''}
        />
      )}
    </>
  );
}
