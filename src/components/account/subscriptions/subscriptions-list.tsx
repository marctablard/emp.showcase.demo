'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Ban, MoveRight, Pause, Play, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/dashboard-badge';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSubscriptions } from '@/hooks/subscriptions/useSubscriptions';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { Subscription } from '@/platform/services/subscription/SubscriptionService';
import { SubscriptionsLightbox } from './subscriptions-lightbox';

interface SubscriptionsListProps {
  className?: string;
}

export function SubscriptionsList({ className }: SubscriptionsListProps) {
  const tAccount = useTranslations('account');
  const t = useTranslations('account.Subscriptions');

  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});

  const { data, loading, error, fetchSubscriptions, hasNextPage, hasPreviousPage, page } = useSubscriptions({
    initialPageSize: 10,
  });

  useEffect(() => {
    fetchSubscriptions(0);
  }, [fetchSubscriptions]);

  // Fetch company names for all unique company IDs
  useEffect(() => {
    const subscriptions = data?.items ?? [];
    const uniqueCompanyIds = Array.from(
      new Set(subscriptions.map((sub) => sub.configuration.companyId).filter(Boolean)),
    );

    const fetchCompanyNames = async () => {
      const names: Record<string, string> = {};
      await Promise.all(
        uniqueCompanyIds.map(async (companyId) => {
          try {
            const response = await fetch(`/api/company/${companyId}`);
            if (response.ok) {
              const company = await response.json();
              names[companyId] = company.name || companyId;
            } else {
              names[companyId] = companyId;
            }
          } catch {
            names[companyId] = companyId;
          }
        }),
      );
      setCompanyNames(names);
    };

    if (uniqueCompanyIds.length > 0) {
      fetchCompanyNames();
    }
  }, [data?.items]);

  const openCreate = () => {
    setSelectedSubscription(null);
    setLightboxOpen(true);
  };

  const openEdit = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setLightboxOpen(true);
  };

  const handleCloseLightbox = (changed?: boolean) => {
    setLightboxOpen(false);
    if (changed) {
      fetchSubscriptions(page);
    }
  };

  const handleQuickAction = async (subscription: Subscription, action: 'pause' | 'resume' | 'cancel') => {
    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        throw new Error('Failed to update subscription');
      }
      fetchSubscriptions(page);
    } catch (e) {
      console.error('Failed to update subscription status', e);
    }
  };

  // Get the appropriate status badge variant
  const getStatusBadge = (sub: Subscription) => {
    const cfg = sub.configuration;
    if (!cfg.active && cfg.endDate) {
      return { variant: 'default' as const, label: t('lightbox.statusCancelled') };
    }
    if (!cfg.active) {
      return { variant: 'warning' as const, label: t('lightbox.statusPaused') };
    }
    return { variant: 'success' as const, label: t('lightbox.statusActive') };
  };

  const renderStatus = (sub: Subscription) => {
    const statusBadge = getStatusBadge(sub);
    return <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>;
  };

  const subscriptions = data?.items ?? [];

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-text-secondary mt-1">{t('description')}</p>
        </div>
        <Button variant="primary" onClick={openCreate} iconBefore={<Plus className="h-4 w-4" />}>
          {t('list.create')}
        </Button>
      </div>

      {error && (
        <div className="bg-surface-error border border-border-error text-text-error px-4 py-3 rounded mb-4">
          {error.message}
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-base">
              <TableHead className="whitespace-nowrap font-bold">{t('list.company')}</TableHead>
              <TableHead className="whitespace-nowrap font-bold">{t('list.status')}</TableHead>
              <TableHead className="whitespace-nowrap font-bold">{t('list.nextOrderDate')}</TableHead>
              <TableHead className="whitespace-nowrap font-bold">
                {t('lightbox.frequency')} / {t('lightbox.interval')}
              </TableHead>
              <TableHead className="whitespace-nowrap font-bold">{t('list.numberOfProducts')}</TableHead>
              <TableHead className="whitespace-nowrap text-right font-bold">{t('list.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <Spinner color="primary" variant="md" />
                  </div>
                </TableCell>
              </TableRow>
            ) : subscriptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-text-secondary">
                  {t('list.noSubscriptions')}
                </TableCell>
              </TableRow>
            ) : (
              subscriptions.map((sub, index) => (
                <TableRow
                  key={sub.id}
                  className={cn(
                    'hover:bg-surface-image-background cursor-pointer text-base',
                    index % 2 === 0 ? 'bg-surface-page' : 'bg-surface-image-background',
                  )}
                  onClick={() => openEdit(sub)}
                >
                  <TableCell className="font-medium px-2 py-4">
                    {companyNames[sub.configuration.companyId] || sub.configuration.companyId}
                  </TableCell>
                  <TableCell className="px-2 py-4">{renderStatus(sub)}</TableCell>
                  <TableCell className="px-2 py-4">
                    {sub.configuration.nextOrderDate ? formatDate(sub.configuration.nextOrderDate) : '-'}
                  </TableCell>
                  <TableCell className="px-2 py-4">
                    {sub.configuration.frequency} {sub.configuration.interval}
                  </TableCell>
                  <TableCell className="px-2 py-4">{sub.items.length}</TableCell>
                  <TableCell className="px-2 py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => openEdit(sub)}
                      iconBefore={<MoveRight className="h-4 w-4" />}
                    >
                      {t('quickActions.edit')}
                    </Button>
                    {sub.configuration.active ? (
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => handleQuickAction(sub, 'pause')}
                        iconBefore={<Pause className="h-4 w-4" />}
                      >
                        {t('quickActions.pause')}
                      </Button>
                    ) : (
                      !sub.configuration.endDate && (
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => handleQuickAction(sub, 'resume')}
                          iconBefore={<Play className="h-4 w-4" />}
                        >
                          {t('quickActions.resume')}
                        </Button>
                      )
                    )}
                    {!sub.configuration.endDate && (
                      <Button
                        variant="red"
                        size="small"
                        onClick={() => handleQuickAction(sub, 'cancel')}
                        iconBefore={<Ban className="h-4 w-4" />}
                      >
                        {t('quickActions.cancel')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {(hasNextPage || hasPreviousPage) && (
        <div className="flex items-center justify-end mt-4 space-x-2">
          <Button
            variant="neutral"
            size="small"
            disabled={!hasPreviousPage}
            onClick={() => fetchSubscriptions((data?.page ?? 0) - 1)}
          >
            {tAccount('quotesList.previous')}
          </Button>
          <Button
            variant="neutral"
            size="small"
            disabled={!hasNextPage}
            onClick={() => fetchSubscriptions((data?.page ?? 0) + 1)}
          >
            {tAccount('quotesList.next')}
          </Button>
        </div>
      )}

      {lightboxOpen && (
        <SubscriptionsLightbox subscription={selectedSubscription} open={lightboxOpen} onClose={handleCloseLightbox} />
      )}
    </div>
  );
}
