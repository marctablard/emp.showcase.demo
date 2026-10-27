'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { Ban, CircleCheck, Package, Pencil, Search, Trash2 } from 'lucide-react';
import {
  AccountDetailContainer,
  AccountDetailHeader,
  AccountDetailStatus,
  AccountSectionBar,
  AccountSectionLabel,
} from '@/components/account/shared/account-detail';
import {
  AccountSpecTable,
  SpecFullWidthRow,
  SpecRow,
  SpecSection,
} from '@/components/account/shared/account-spec-table';
import { QuickOrderSearchDropdown } from '@/components/quick-order/quick-order-search-dropdown';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
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
import { QuantityStepper } from '@/components/ui/molecules/quantity-stepper';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { useSearch } from '@/hooks/search/useSearch';
import { useL10n } from '@/hooks/useL10n';
import {
  cancelSubscription,
  fetchSubscription,
  pauseSubscription,
  resumeSubscription,
  setSubscriptionCadence,
  setSubscriptionItems,
} from '@/lib/client/subscriptions';
import { clearMarkHighlights } from '@/lib/common/clear-mark-highlights';
import { formatDate } from '@/lib/date-utils';
import type { Product } from '@/platform/services/model/product';
import {
  SUBSCRIPTION_INTERVALS,
  type Subscription,
  type SubscriptionInterval,
  type SubscriptionItem,
} from '@/platform/services/subscription/subscription-rules';
import { SubscriptionStatusBadge } from './subscription-status-badge';

const PRODUCT_SEARCH_INPUT_ID = 'subscription-productSearch';

function failureTitle(t: ReturnType<typeof useTranslations<'account.subscriptions'>>, err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  if (message === 'empty') return t('issues.empty');
  if (message === 'missing-cadence') return t('issues.missing-cadence');
  if (message === 'conflicting-cadence') return t('issues.conflicting-cadence');
  if (message === 'invalid-every') return t('issues.invalid-every');
  if (message === 'cancelled') return t('issues.cancelled');
  return message || t('loadError');
}

const sameItems = (left: SubscriptionItem[], right: SubscriptionItem[]): boolean =>
  left.length === right.length &&
  left.every((item) => right.some((other) => other.productId === item.productId && other.quantity === item.quantity));

export function SubscriptionDetail({ id }: { id: string }) {
  const t = useTranslations('account.subscriptions');
  const tOrder = useTranslations('orders');
  const tPaymentModes = useTranslations('checkout.PaymentModes');
  const locale = useLocale();
  const { l10n } = useL10n();
  const { suggestions, loading: searching, getSuggestions } = useSearch<Product>();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [every, setEvery] = useState(1);
  const [unit, setUnit] = useState<SubscriptionInterval>('months');
  const [items, setItems] = useState<SubscriptionItem[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productSearched, setProductSearched] = useState(false);
  const productSearchRef = useRef<HTMLDivElement>(null);
  const productSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback((next: Subscription) => {
    setSubscription(next);
    setEvery(next.every);
    setUnit(next.unit);
    setItems(next.items.map((item) => ({ ...item })));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSubscription(id)
      .then((next) => {
        if (!cancelled) load(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('loadError'));
      });
    return () => {
      cancelled = true;
    };
  }, [id, load, t]);

  useEffect(
    () => () => {
      if (productSearchTimer.current) clearTimeout(productSearchTimer.current);
    },
    [],
  );

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!productSearchRef.current?.contains(event.target as Node)) setProductSearchOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const addProduct = useCallback(
    (product: Product) => {
      const productId = clearMarkHighlights(product.id);
      const name = clearMarkHighlights(l10n(product.name)) || productId;
      const imageUrl = product.images?.[0]?.url;
      setItems((current) => {
        const existing = current.find((row) => row.productId === productId);
        if (existing) {
          return current.map((row) =>
            row.productId === productId ? { ...row, quantity: row.quantity + 1, name, imageUrl } : row,
          );
        }
        return [...current, { productId, quantity: 1, name, imageUrl }];
      });
      setProductQuery('');
      setProductSearchOpen(false);
      setProductSearched(false);
    },
    [l10n],
  );

  const apply = async (action: () => Promise<Subscription>, success: string): Promise<boolean> => {
    setBusy(true);
    try {
      load(await action());
      notify({ type: ToastType.Success, title: success });
      return true;
    } catch (err) {
      notify({ type: ToastType.Error, title: failureTitle(t, err) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="border border-border-primary bg-surface-page p-6 text-center">
        <p className="text-text-error">{error}</p>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="border border-border-primary bg-surface-page p-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-4 h-5 w-40" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  const cancelled = subscription.status === 'CANCELLED';
  const cadence = t('every', { count: subscription.every, unit: t(`unit.${subscription.unit}`) });
  const owner = subscription.customerName || subscription.customerId || '-';
  const paymentKey = subscription.paymentMethod?.toLowerCase();
  const paymentMethod = paymentKey
    ? tPaymentModes.has(paymentKey as never)
      ? tPaymentModes(paymentKey as never)
      : subscription.paymentMethod
    : '-';
  const productsChanged = !sameItems(items, subscription.items);
  const dateOrDash = (value?: string) => (value ? formatDate(value, locale) : '-');

  return (
    <AccountDetailContainer>
      <AccountDetailHeader
        eyebrow={t('details')}
        title={`#${subscription.id}`}
        aside={
          <AccountDetailStatus label={t('columns.status')}>
            <SubscriptionStatusBadge status={subscription.status} emphasized />
          </AccountDetailStatus>
        }
      />

      <div className="border-b border-border-primary">
        <AccountSpecTable>
          <SpecSection title={t('information')}>
            <SpecRow
              left={{ label: t('created'), value: dateOrDash(subscription.createdAt) }}
              right={{ label: t('lastOrder'), value: dateOrDash(subscription.lastOrderDate) }}
            />
            <SpecRow
              left={{ label: t('columns.nextOrder'), value: cancelled ? '-' : dateOrDash(subscription.nextOrderDate) }}
              right={{ label: t('notifyDate'), value: cancelled ? '-' : dateOrDash(subscription.notificationDate) }}
            />
            <SpecRow
              left={{
                label: t('columns.cadence'),
                value: (
                  <>
                    {cadence}
                    {subscription.frequencyLocked ? (
                      <p className="mt-0.5 text-xs text-text-placeholders">{t('locked')}</p>
                    ) : null}
                  </>
                ),
              }}
              right={{ label: t('columns.owner'), value: owner }}
            />
            <SpecRow
              left={{ label: tOrder('paymentMethod'), value: paymentMethod }}
              right={
                subscription.endDate ? { label: t('endDate'), value: dateOrDash(subscription.endDate) } : undefined
              }
            />
            {cancelled ? <SpecFullWidthRow label={t('columns.status')}>{t('cancelledNotice')}</SpecFullWidthRow> : null}
          </SpecSection>
        </AccountSpecTable>
      </div>

      <section className="border-b border-border-primary">
        <AccountSectionBar>{t('products')}</AccountSectionBar>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[88px] py-4 pl-6 pr-3 font-bold sm:pl-8">{tOrder('product')}</TableHead>
              <TableHead className="px-4 py-4 font-bold" />
              <TableHead className="w-48 py-4 pl-4 pr-6 text-right font-bold sm:pr-8">{tOrder('quantity')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.productId}
                className="hover:bg-transparent"
                data-testid={`subscription-item-${item.productId}`}
              >
                <TableCell className="w-[88px] py-4 pl-6 pr-3 align-middle sm:pl-8">
                  <div className="flex h-[52px] w-20 items-center justify-center border border-border-primary bg-surface-image-background">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name || item.productId}
                        width={80}
                        height={52}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Package className="h-5 w-5 text-icon-secondary opacity-40" aria-hidden="true" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-4 py-4 align-middle">
                  <p className="text-sm font-bold text-text-headings">
                    <UiLink type="Link" href={`/product/${item.productId}`} variant="text">
                      {item.name || item.productId}
                    </UiLink>
                  </p>
                  {item.name ? <p className="mt-0.5 text-xs text-text-placeholders">{item.productId}</p> : null}
                </TableCell>
                <TableCell className="py-4 pl-4 pr-6 align-middle sm:pr-8">
                  {cancelled ? (
                    <p className="text-right text-sm font-medium tabular-nums">{item.quantity}</p>
                  ) : (
                    <div className="flex items-center justify-end gap-3">
                      <div data-testid={`subscription-quantity-${item.productId}`}>
                        <QuantityStepper
                          size="sm"
                          value={item.quantity}
                          onChange={(quantity) =>
                            setItems((current) =>
                              current.map((row) => (row.productId === item.productId ? { ...row, quantity } : row)),
                            )
                          }
                          inputLabel={t('quantity')}
                        />
                      </div>
                      <button
                        type="button"
                        className="text-icon-neutral hover:text-text-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                        aria-label={t('remove')}
                        data-testid={`subscription-remove-${item.productId}`}
                        onClick={() => setItems((current) => current.filter((row) => row.productId !== item.productId))}
                      >
                        <Trash2 className="size-5" aria-hidden />
                      </button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {!cancelled ? (
          <div className="border-t border-border-primary px-6 py-6 sm:px-8">
            <div ref={productSearchRef} className="relative max-w-xl">
              <label htmlFor={PRODUCT_SEARCH_INPUT_ID} className="mb-1 block text-base font-bold">
                {t('addProduct')}
              </label>
              <div className="relative">
                <Input
                  id={PRODUCT_SEARCH_INPUT_ID}
                  type="text"
                  value={productQuery}
                  onChange={(event) => {
                    const value = event.target.value;
                    setProductQuery(value);
                    if (productSearchTimer.current) clearTimeout(productSearchTimer.current);
                    if (value.trim().length < 2) {
                      setProductSearchOpen(false);
                      setProductSearched(false);
                      return;
                    }
                    productSearchTimer.current = setTimeout(() => {
                      setProductSearched(true);
                      setProductSearchOpen(true);
                      void getSuggestions(value, locale);
                    }, 300);
                  }}
                  placeholder={t('productSearch')}
                  className="pr-10"
                  role="combobox"
                  aria-expanded={productSearchOpen}
                  aria-haspopup="listbox"
                  aria-autocomplete="list"
                  aria-controls="quick-order-search-results"
                  autoComplete="off"
                  data-testid="subscription-productSearch"
                />
                <Search className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-placeholders" />
                {productSearchOpen ? (
                  <QuickOrderSearchDropdown
                    products={suggestions.products}
                    loading={searching}
                    hasSearched={productSearched}
                    highlightedIndex={-1}
                    onSelect={addProduct}
                  />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="border-b border-border-primary">
        <AccountSectionBar>{t('history')}</AccountSectionBar>
        {subscription.orders.length === 0 ? (
          <p className="px-6 py-6 text-sm text-text-placeholders sm:px-8">{t('noHistory')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-4 pl-6 pr-3 font-bold sm:pl-8">{t('columns.order')}</TableHead>
                <TableHead className="py-4 pl-4 pr-6 text-right font-bold sm:pr-8">{tOrder('orderDate')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscription.orders.map((order) => (
                <TableRow key={order.orderId} className="hover:bg-transparent">
                  <TableCell className="py-4 pl-6 pr-3 text-sm sm:pl-8">
                    <UiLink
                      type="Link"
                      href={`/account/orders/${order.orderId}`}
                      variant="primary"
                      data-testid={`subscription-order-${order.orderId}`}
                    >
                      #{order.orderId}
                    </UiLink>
                  </TableCell>
                  <TableCell className="py-4 pl-4 pr-6 text-right text-sm sm:pr-8">{dateOrDash(order.date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {!cancelled ? (
        <footer className="px-6 py-6 sm:px-8" data-testid="subscription-actions">
          <AccountSectionLabel className="mb-3">{t('actions')}</AccountSectionLabel>
          <div className="flex flex-wrap gap-2">
            {productsChanged ? (
              <Button
                variant="secondary"
                size="small"
                disabled={busy || items.length === 0}
                data-testid="subscription-saveProducts"
                onClick={() => void apply(() => setSubscriptionItems(subscription.id, items), t('productsSaved'))}
              >
                <CircleCheck className="mr-2 h-4 w-4" />
                {t('saveProducts')}
              </Button>
            ) : null}
            {subscription.frequencyLocked ? null : (
              <Button
                variant="secondary"
                size="small"
                disabled={busy}
                data-testid="subscription-changeSchedule"
                onClick={() => setScheduleOpen(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {t('changeSchedule')}
              </Button>
            )}
            {subscription.status === 'ACTIVE' ? (
              <Button
                variant="secondary"
                size="small"
                disabled={busy}
                data-testid="subscription-pauseButton"
                onClick={() => void apply(() => pauseSubscription(subscription.id), t('paused'))}
              >
                {t('pause')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="small"
                disabled={busy}
                data-testid="subscription-resumeButton"
                onClick={() => void apply(() => resumeSubscription(subscription.id), t('resumed'))}
              >
                {t('resume')}
              </Button>
            )}
            <Button
              variant="secondary"
              size="small"
              disabled={busy}
              data-testid="subscription-cancelButton"
              onClick={() => setConfirmCancel(true)}
            >
              <Ban className="mr-2 h-4 w-4" />
              {t('cancel')}
            </Button>
          </div>
        </footer>
      ) : null}

      <Dialog open={scheduleOpen} onOpenChange={(open) => !busy && setScheduleOpen(open)}>
        <DialogContent data-testid="subscription-scheduleDialog" closeTestId="subscription-scheduleClose">
          <DialogHeader>
            <DialogTitle>{t('changeSchedule')}</DialogTitle>
            <DialogDescription>{t('changeScheduleBody')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
            <Input
              type="number"
              min={1}
              step={1}
              value={every}
              aria-label={t('renewEvery')}
              onChange={(event) => setEvery(Number(event.target.value))}
              data-testid="subscription-every"
            />
            <Select value={unit} onValueChange={(value) => setUnit(value as SubscriptionInterval)}>
              <SelectTrigger aria-label={t('renewUnit')} data-testid="subscription-unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBSCRIPTION_INTERVALS.map((value) => (
                  <SelectItem key={value} value={value} data-testid={`subscription-unit-${value}`}>
                    {t(`unit.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              disabled={busy}
              data-testid="subscription-scheduleDismiss"
              onClick={() => {
                setEvery(subscription.every);
                setUnit(subscription.unit);
                setScheduleOpen(false);
              }}
            >
              {t('keep')}
            </Button>
            <Button
              disabled={busy}
              data-testid="subscription-saveCadence"
              onClick={() =>
                void apply(() => setSubscriptionCadence(subscription.id, every, unit), t('cadenceSaved')).then((ok) => {
                  if (ok) setScheduleOpen(false);
                })
              }
            >
              {t('saveCadence')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={confirmCancel}
        onOpenChange={(open) => !busy && setConfirmCancel(open)}
        title={t('cancelTitle')}
        description={t('cancelBody')}
        cancelLabel={t('keepSubscription')}
        confirmLabel={t('cancelConfirm')}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() =>
          void apply(() => cancelSubscription(subscription.id), t('cancelled')).then(() => setConfirmCancel(false))
        }
        pending={busy}
        testIdPrefix="subscription-cancel"
      />
    </AccountDetailContainer>
  );
}
