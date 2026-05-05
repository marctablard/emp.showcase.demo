'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowRight, History, Search, X } from 'lucide-react';
import MarkedText from '@/components/header/search/marked-text';
import { ProductTileFlyOut } from '@/components/product/product-tile-fly-out';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHistory } from '@/hooks/history/useHistory';
import { useSearch } from '@/hooks/search/useSearch';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { Product } from '@/platform/services/model/product';

const SUGGESTION_DEBOUNCE_MS = 360;
const MIN_QUERY_LENGTH = 2;
const MAX_PRODUCTS_IN_FLYOUT = 6;

export interface CmsSearchProps {
  className?: string;
}

/**
 * Self-contained search bar for the CMS header. Renders the flyout as an
 * absolutely-positioned sibling of the input — its offset parent is the
 * nearest positioned ancestor (the `<header>` element, which is `relative`),
 * so the flyout spans the full header width and drops below the header row
 * instead of stretching the search bar's flex slot.
 */
export function CmsSearch({ className }: CmsSearchProps) {
  const t = useTranslations('layout.header');
  const router = useRouter();
  const locale = useLocale();
  const { searchHistory, clearSearchHistory } = useHistory();
  const { suggestions, loading, getSuggestions, currentQuery } = useSearch<Product>();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(currentQuery || '');
  const [hasFetched, setHasFetched] = useState(Boolean(currentQuery));

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    inputRef.current?.blur();
  }, []);

  const goToBrowse = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;
      close();
      router.push(`/browse?q=${encodeURIComponent(trimmed)}`);
    },
    [close, query, router],
  );

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim().length >= MIN_QUERY_LENGTH) {
        setHasFetched(true);
        getSuggestions(value, locale);
      }
    }, SUGGESTION_DEBOUNCE_MS);
  };

  const handleQuerySelect = (selected: string) => {
    setQuery(selected);
    setHasFetched(true);
    getSuggestions(selected, locale);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const isSearching = query.trim().length >= MIN_QUERY_LENGTH;
  const completions = isSearching ? suggestions.queryCompletions : searchHistory;
  const products = isSearching ? suggestions.products.slice(0, MAX_PRODUCTS_IN_FLYOUT) : [];
  // Only mount the flyout panel when there is something meaningful to show —
  // chip suggestions/history, an active search (loading/results/no-results),
  // otherwise the panel would render as an empty padded box.
  const hasFlyoutContent = completions.length > 0 || (isSearching && hasFetched);

  return (
    // Intentionally NOT `relative` — the flyout below uses `absolute top-full
    // left-0 right-0` and we want it to position against the `<header>`.
    <div ref={containerRef} className={cn('w-full', className)}>
      <form onSubmit={goToBrowse} className="relative flex w-full items-center">
        <Input
          ref={inputRef}
          type="search"
          placeholder={t('search')}
          value={query}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') goToBrowse(e);
          }}
          className="h-11 w-full rounded-form-field border border-transparent bg-surface-search-input py-2 pl-6 pr-20 text-text-headings placeholder:text-text-placeholders hover:border-border-action-hover hover:bg-surface-search-input"
          data-testid="cms-header-searchInput"
        />
        {query ? (
          <Button
            type="button"
            variant="link"
            aria-label={t('close')}
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-12 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent"
          >
            <X className="text-icon-primary-dark" width={20} height={20} />
          </Button>
        ) : null}
        <Button
          type="submit"
          variant="link"
          aria-label={t('searchProducts')}
          className="absolute right-0 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent pr-6"
        >
          <Search className="text-icon-primary-dark" width={24} height={24} />
        </Button>
      </form>

      {open && hasFlyoutContent ? (
        <div
          role="dialog"
          aria-label={t('search')}
          className="absolute left-0 right-0 top-full z-50 max-h-[80vh] overflow-y-auto border-t border-border-primary bg-surface-page shadow-2xl"
        >
          <div className="mx-auto max-w-7xl px-6 py-6 md:px-12">
            {completions.length > 0 ? (
              <div className="mb-6 flex flex-wrap gap-2">
                {completions.map((completion) => (
                  <Button
                    key={completion}
                    type="button"
                    onClick={() => handleQuerySelect(completion)}
                    className="rounded-pills bg-surface-disabled p-2 font-medium normal-case text-text-heading hover:bg-surface-hover-grey"
                  >
                    {isSearching ? (
                      <span className="truncate sm:max-w-[48ch]">
                        <MarkedText text={completion} keyword={query} />
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <History className="h-4 w-4" />
                        <span className="truncate sm:max-w-[48ch]">{completion}</span>
                      </span>
                    )}
                  </Button>
                ))}
                {!isSearching ? (
                  <Button
                    type="button"
                    variant="link"
                    onClick={clearSearchHistory}
                    className="font-medium text-text-heading"
                  >
                    {t('clearHistory')}
                  </Button>
                ) : null}
              </div>
            ) : null}

            {isSearching && hasFetched ? (
              loading ? (
                <p className="text-sm text-text-body" aria-live="polite">
                  …
                </p>
              ) : products.length > 0 ? (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-headlines text-lg">{t('suggestedProducts')}</h3>
                    <Link
                      href={`/browse?q=${encodeURIComponent(query)}`}
                      onClick={close}
                      className="inline-flex items-center gap-1 font-bold text-text-action hover:text-text-action-hover"
                    >
                      {t('showAllProducts')}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {products.map((product) => (
                      <ProductTileFlyOut key={product.id} product={product} keyword={query} onProductClick={close} />
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-text-body">{t('noResults')}</p>
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CmsSearch;
