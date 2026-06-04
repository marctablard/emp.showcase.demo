'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CircleCheck, CircleX, Plus, Search, X } from 'lucide-react';
import { QuoteAddProductResultRow } from '@/components/account/quotes/quote-add-product-result-row';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { H5 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { useProductNameSearch } from '@/hooks/product/useProductNameSearch';
import {
  type QuoteAddItemOutcome,
  addProductsToQuote,
  pollQuoteAddItemOutcomes,
} from '@/lib/client/quote-add-products';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn } from '@/lib/utils';
import type { Product } from '@/platform/services/model/product';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const SEARCH_INPUT_ID = 'quote-add-products-search-input';
const SEARCH_HINT_ID = 'quote-add-products-search-hint';
const REQUEST_ACCEPTED_TOAST_MS = 3000;

interface QuoteAddProductsProps {
  quoteId: string;
  onProductsAdded?: () => void;
}

interface ProductSelection {
  product: Product;
  quantity: number;
  selected: boolean;
}

interface DismissibleOutcome extends QuoteAddItemOutcome {
  key: string;
}

function SearchResultSkeleton() {
  return (
    <div className="rounded-md border border-border-primary bg-surface-page p-4">
      <div className="flex gap-4">
        <div className="h-6 w-6 shrink-0 animate-pulse rounded-sm bg-surface-secondary" />
        <div className="h-[65px] w-[100px] shrink-0 animate-pulse rounded-ss-md rounded-ee-md bg-surface-secondary" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-3 w-24 animate-pulse rounded bg-surface-secondary" />
          <div className="h-5 w-3/4 max-w-xs animate-pulse rounded bg-surface-secondary" />
          <div className="h-3 w-32 animate-pulse rounded bg-surface-secondary" />
        </div>
      </div>
    </div>
  );
}

export function QuoteAddProducts({ quoteId, onProductsAdded }: QuoteAddProductsProps) {
  const t = useTranslations('account.quoteDetails.addProducts');
  const tCart = useTranslations('cart');
  const logger = getLogger();
  const { products, loading, pricesLoading, error: searchError, search, reset: resetSearch } = useProductNameSearch();

  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selections, setSelections] = useState<Record<string, ProductSelection>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [outcomeAlerts, setOutcomeAlerts] = useState<DismissibleOutcome[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSelections((prev) => {
      const next: Record<string, ProductSelection> = {};
      for (const product of products) {
        next[product.id] = prev[product.id] ?? { product, quantity: 1, selected: false };
        next[product.id].product = product;
      }
      return next;
    });
  }, [products]);

  const selectedItems = useMemo(
    () => Object.values(selections).filter((entry) => entry.selected && entry.quantity >= 1),
    [selections],
  );

  const dismissOutcome = useCallback((key: string) => {
    setOutcomeAlerts((prev) => prev.filter((entry) => entry.key !== key));
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (value.trim().length >= MIN_QUERY_LENGTH) {
        debounceRef.current = setTimeout(() => {
          setHasSearched(true);
          void search(value);
        }, DEBOUNCE_MS);
      } else {
        setHasSearched(false);
        setSelections({});
        resetSearch();
      }
    },
    [resetSearch, search],
  );

  const updateSelection = useCallback(
    (productId: string, patch: Partial<Pick<ProductSelection, 'selected' | 'quantity'>>) => {
      setSelections((prev) => {
        const current = prev[productId];
        if (!current) {
          return prev;
        }
        return {
          ...prev,
          [productId]: { ...current, ...patch },
        };
      });
    },
    [],
  );

  const handleAddToQuote = useCallback(async () => {
    if (selectedItems.length === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addProductsToQuote(
        quoteId,
        selectedItems.map((entry) => ({
          productId: entry.product.id,
          quantity: entry.quantity,
        })),
      );

      if (!result.accepted || !result.requests?.length) {
        notify({
          title: t('addFailedTitle'),
          description: result.error || t('addFailedDescription'),
          type: ToastType.Error,
        });
        return;
      }

      notify({
        title: t('requestAcceptedTitle'),
        type: ToastType.Info,
        duration: REQUEST_ACCEPTED_TOAST_MS,
      });

      setQuery('');
      setHasSearched(false);
      setSelections({});
      resetSearch();

      setIsPolling(true);
      try {
        const outcomes = await pollQuoteAddItemOutcomes(result.requests);
        setOutcomeAlerts(
          outcomes.map((outcome) => ({
            ...outcome,
            key: `${outcome.notificationId}-${outcome.productId}`,
          })),
        );

        if (outcomes.some((outcome) => outcome.responseStatus === 'SUCCESS')) {
          onProductsAdded?.();
        }
      } catch (pollError) {
        logger.error({ err: pollError, quoteId }, 'Timed out polling quote add-item notifications');
        setOutcomeAlerts([
          {
            key: 'poll-timeout',
            productId: '',
            notificationId: '',
            responseStatus: '',
            responseMessage: t('pollTimeoutDescription'),
          },
        ]);
      } finally {
        setIsPolling(false);
      }
    } catch (error) {
      logger.error({ err: error, quoteId }, 'Failed to add products to quote');
      notify({
        title: t('addFailedTitle'),
        description: t('addFailedDescription'),
        type: ToastType.Error,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [logger, onProductsAdded, quoteId, resetSearch, selectedItems, t]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const showResultsPanel = loading || hasSearched || products.length > 0;
  const isBusy = isSubmitting || isPolling;

  return (
    <section
      ref={containerRef}
      className="mt-8 flex flex-col gap-6 rounded-md bg-surface-page p-6 shadow-sm"
      data-testid="quote-add-products"
    >
      <div>
        <H5 className="mb-1">{t('title')}</H5>
        <p className="text-sm leading-5 text-text-placeholders">{t('description')}</p>
      </div>

      {outcomeAlerts.map((outcome) => {
        const isTimeout = outcome.key === 'poll-timeout';
        const isSuccess = outcome.responseStatus === 'SUCCESS';
        const isDenied = outcome.responseStatus === 'DENIED';

        return (
          <Alert
            key={outcome.key}
            variant={isDenied || isTimeout ? 'destructive' : 'default'}
            className={cn(
              isSuccess && 'border-border-success bg-surface-success text-text-body',
              isDenied && 'border-border-error',
            )}
            data-testid={`quote-add-outcome-${outcome.key}`}
          >
            {isSuccess && <CircleCheck className="text-text-success" />}
            {(isDenied || isTimeout) && <CircleX />}
            <div className="col-start-2 flex w-full items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <AlertTitle>
                  {isTimeout ? t('pollTimeoutTitle') : isSuccess ? t('resultSuccessTitle') : t('resultDeniedTitle')}
                </AlertTitle>
                {outcome.productId && (
                  <p className="mt-0.5 text-xs text-text-placeholders">
                    {t('resultProductLabel', { productId: outcome.productId })}
                  </p>
                )}
                <AlertDescription className="mt-1 text-text-body">
                  {outcome.responseMessage || (isTimeout ? t('pollTimeoutDescription') : t('addFailedDescription'))}
                </AlertDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label={t('closeResult')}
                onClick={() => dismissOutcome(outcome.key)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Alert>
        );
      })}

      {isPolling && (
        <p
          className="flex items-center gap-2 text-sm text-text-placeholders"
          role="status"
          data-testid="quote-add-polling"
        >
          <Spinner variant="sm" />
          {t('processing')}
        </p>
      )}

      <div>
        <label htmlFor={SEARCH_INPUT_ID} className="mb-1 block text-base font-bold">
          {t('searchLabel')}
        </label>
        <p id={SEARCH_HINT_ID} className="mb-2 text-[12px] leading-5 text-text-placeholders">
          {t('searchHint')}
        </p>
        <div className="relative max-w-xl">
          <Input
            id={SEARCH_INPUT_ID}
            type="search"
            value={query}
            onChange={handleInputChange}
            placeholder={t('searchPlaceholder')}
            className="h-12 pr-10"
            autoComplete="off"
            aria-describedby={SEARCH_HINT_ID}
            data-testid="quote-add-products-search-input"
            disabled={isBusy}
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-placeholders" />
        </div>
      </div>

      {searchError && (
        <p
          className="rounded-md border border-border-error bg-surface-error px-4 py-3 text-sm text-text-error"
          role="alert"
        >
          {t('searchFailed')}
        </p>
      )}

      {showResultsPanel && (
        <div className="flex flex-col gap-3">
          {!loading && products.length > 0 && (
            <div className="hidden border-b border-border-primary pb-2 sm:grid sm:grid-cols-[minmax(0,1fr)_120px_140px] sm:gap-4 sm:px-4">
              <p className="text-sm font-bold font-headlines text-text-body">{tCart('product')}</p>
              <p className="text-end text-sm font-bold font-headlines text-text-body">{tCart('price')}</p>
              <p className="text-end text-sm font-bold font-headlines text-text-body">{tCart('qty')}</p>
            </div>
          )}

          <div
            className={cn(
              'flex max-h-[28rem] flex-col gap-3 overflow-y-auto',
              !loading &&
                hasSearched &&
                products.length === 0 &&
                'rounded-md border border-border-primary bg-surface-action-hover-2/30 px-6 py-10',
            )}
          >
            {loading && Array.from({ length: 3 }).map((_, index) => <SearchResultSkeleton key={`skeleton-${index}`} />)}

            {!loading && hasSearched && products.length === 0 && !searchError && (
              <p className="text-center text-sm text-text-placeholders" role="status">
                {t('noResults')}
              </p>
            )}

            {!loading &&
              products.map((product) => {
                const selection = selections[product.id];
                if (!selection) {
                  return null;
                }

                const plainName =
                  (product.name &&
                    String(product.name)
                      .replace(/<[^>]+>/g, '')
                      .trim()) ||
                  product.id;

                return (
                  <QuoteAddProductResultRow
                    key={product.id}
                    product={selection.product}
                    selected={selection.selected}
                    quantity={selection.quantity}
                    pricesLoading={pricesLoading}
                    disabled={isBusy}
                    selectLabel={t('selectProduct', { name: plainName })}
                    onToggleSelected={() => updateSelection(product.id, { selected: !selection.selected })}
                    onQuantityChange={(quantity) => updateSelection(product.id, { quantity })}
                  />
                );
              })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 border-t border-border-primary pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-placeholders">
          {selectedItems.length > 0 ? t('selectedCount', { count: selectedItems.length }) : t('selectProductsHint')}
        </p>
        <Button
          variant="primary"
          onClick={handleAddToQuote}
          disabled={isBusy || selectedItems.length === 0}
          className="h-12 w-full font-headlines tracking-[2px] sm:w-auto sm:min-w-[216px]"
          data-testid="quote-add-products-submit"
        >
          {isBusy ? (
            <>
              <Spinner variant="sm" color="white" />
              <span className="ml-2">{t('adding')}</span>
            </>
          ) : (
            <>
              {t('addToQuote')}
              <Plus className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
