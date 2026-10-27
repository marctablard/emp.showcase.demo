'use client';

import { Fragment, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import {
  AccountListContainer,
  accountTableBadgeCellClass,
  accountTableBadgeHeadClass,
  accountTableHeadClass,
  accountTableHeadRowClass,
  accountTableRowClass,
  shortenId,
} from '@/components/account/shared/account-list';
import { AccountPageHeader } from '@/components/account/shared/account-page-header';
import { AccountProductLines } from '@/components/account/shared/account-product-lines';
import { AccountProductThumbnails } from '@/components/account/shared/account-product-thumbnails';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDebouncedValue } from '@/hooks/common/useDebouncedValue';
import { useRouter } from '@/i18n/navigation';
import { fetchSubscriptions } from '@/lib/client/subscriptions';
import { formatDate } from '@/lib/date-utils';
import type { Subscription } from '@/platform/services/subscription/subscription-rules';
import { SubscriptionStatusBadge } from './subscription-status-badge';

const SEARCH_DEBOUNCE_MS = 300;
const COLUMN_COUNT = 6;

function subscriptionMatches(subscription: Subscription, term: string): boolean {
  if (!term) return true;
  const fields = [
    subscription.id,
    subscription.name,
    subscription.customerName,
    subscription.customerId,
    ...subscription.items.flatMap((item) => [item.name, item.productId]),
  ];
  return fields.some((field) => field?.toLowerCase().includes(term));
}

function productMatches(subscription: Subscription, term: string): boolean {
  if (!term) return false;
  return subscription.items.some(
    (item) => item.name?.toLowerCase().includes(term) || item.productId.toLowerCase().includes(term),
  );
}

export function SubscriptionsList({ scope }: { scope: 'mine' | 'company' }) {
  const t = useTranslations('account.subscriptions');
  const tAccount = useTranslations('account');
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState<Subscription[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const term = useDebouncedValue(query, SEARCH_DEBOUNCE_MS).trim().toLowerCase();
  const company = scope === 'company';

  useEffect(() => {
    let cancelled = false;
    fetchSubscriptions(scope)
      .then((next) => {
        if (!cancelled) setItems(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('loadError'));
      });
    return () => {
      cancelled = true;
    };
  }, [scope, t]);

  const visible = (items ?? []).filter((subscription) => subscriptionMatches(subscription, term));
  const searching = query.trim().length > 0 && query.trim().toLowerCase() !== term;

  return (
    <div className="space-y-6">
      <AccountPageHeader
        eyebrow={company ? tAccount('sidebar.groups.myOrganisation') : tAccount('sidebar.groups.orderManagement')}
        title={company ? t('companyTitle') : t('title')}
        description={company ? t('companyDescription') : t('description')}
      />
      {error ? <p className="text-sm text-text-error">{error}</p> : null}
      {items == null && !error ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : null}
      {items ? (
        <>
          <div className="w-full max-w-[380px]">
            <div className="relative w-full">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('searchPlaceholder')}
                className="pr-10"
                endIcon={searching ? undefined : Search}
                aria-label={t('searchPlaceholder')}
                data-testid="subscriptions-search"
              />
              {searching ? (
                <Spinner
                  variant="sm"
                  color="primary"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                  loadingText={t('title')}
                />
              ) : null}
            </div>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-text-placeholders">{company ? t('companyEmpty') : t('empty')}</p>
          ) : (
            <AccountListContainer>
              <Table>
                <TableHeader>
                  <TableRow className={accountTableHeadRowClass}>
                    <TableHead className={accountTableHeadClass}>{t('columns.id')}</TableHead>
                    <TableHead className={accountTableHeadClass}>{t('columns.owner')}</TableHead>
                    <TableHead className={accountTableHeadClass}>{t('columns.products')}</TableHead>
                    <TableHead className={accountTableHeadClass}>{t('columns.cadence')}</TableHead>
                    <TableHead className={accountTableHeadClass}>{t('columns.nextOrder')}</TableHead>
                    <TableHead className={accountTableBadgeHeadClass}>{t('columns.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={COLUMN_COUNT} className="py-4 text-center">
                        {t('noMatches')}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {visible.map((subscription, index) => {
                    const open = expanded[subscription.id] ?? productMatches(subscription, term);
                    return (
                      <Fragment key={subscription.id}>
                        <TableRow
                          className={accountTableRowClass(index, { clickable: true })}
                          data-testid={`subscriptions-row-${subscription.id}`}
                          onClick={() => router.push(`/account/subscriptions/${subscription.id}`)}
                        >
                          <TableCell className="px-2 py-4 font-medium">
                            <span title={subscription.id}>
                              <UiLink
                                type="Link"
                                href={`/account/subscriptions/${subscription.id}`}
                                variant="primary"
                                data-testid={`subscriptions-id-${subscription.id}`}
                              >
                                {shortenId(subscription.id)}
                              </UiLink>
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-4">
                            {subscription.customerName || subscription.customerId || '—'}
                          </TableCell>
                          <TableCell className="px-2 py-4" onClick={(event) => event.stopPropagation()}>
                            <AccountProductThumbnails
                              items={subscription.items.map((item) => ({ imageUrl: item.imageUrl, name: item.name }))}
                              onToggle={() =>
                                setExpanded((current) => ({
                                  ...current,
                                  [subscription.id]: !(current[subscription.id] ?? productMatches(subscription, term)),
                                }))
                              }
                              expanded={open}
                              toggleLabel={t('columns.products')}
                              data-testid={`subscriptions-products-${subscription.id}`}
                            />
                          </TableCell>
                          <TableCell className="px-2 py-4">
                            {t('every', { count: subscription.every, unit: t(`unit.${subscription.unit}`) })}
                          </TableCell>
                          <TableCell className="px-2 py-4">
                            {subscription.nextOrderDate ? formatDate(subscription.nextOrderDate, locale) : '—'}
                          </TableCell>
                          <TableCell className={accountTableBadgeCellClass}>
                            <SubscriptionStatusBadge status={subscription.status} />
                          </TableCell>
                        </TableRow>
                        {open ? (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={COLUMN_COUNT} className="border-t border-border-primary p-0">
                              <AccountProductLines
                                lines={subscription.items.map((item) => ({
                                  id: item.productId,
                                  imageUrl: item.imageUrl,
                                  name: item.name,
                                  quantity: item.quantity,
                                }))}
                              />
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </AccountListContainer>
          )}
        </>
      ) : null}
    </div>
  );
}
