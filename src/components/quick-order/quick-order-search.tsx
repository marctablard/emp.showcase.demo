'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { H5 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useSearch } from '@/hooks/search/useSearch';
import { useToast } from '@/hooks/ui/useToast';
import { fetchProductAvailability } from '@/lib/client/availability';
import { fetchProductPrice } from '@/lib/client/prices';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn } from '@/lib/utils';
import type { Product } from '@/platform/services/model/product';
import { useSessionStore } from '@/providers/StoreProvider';
import { QuickOrderSearchDropdown } from './quick-order-search-dropdown';
import { QuickOrderTextPaste } from './quick-order-text-paste';
import type { QuickOrderTextPasteHandle } from './quick-order-text-paste';

interface QuickOrderSearchProps {
  onAddProducts: (entries: Array<{ product: Product; quantity: number }>) => void;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const SEARCH_INPUT_ID = 'quick-order-search-input';
const SEARCH_HINT_ID = 'quick-order-search-hint';

export function QuickOrderSearch({ onAddProducts }: QuickOrderSearchProps) {
  const t = useTranslations('quick-order');
  const locale = useLocale();
  const { suggestions, loading, getSuggestions } = useSearch<Product>();
  const { toast } = useToast();
  const logger = getLogger();
  const sessionCurrency = useSessionStore().session?.currency;

  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [textPasteResolving, setTextPasteResolving] = useState(false);
  const [textPasteHasText, setTextPasteHasText] = useState(false);
  const [textPasteHasErrors, setTextPasteHasErrors] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const textPasteRef = useRef<QuickOrderTextPasteHandle>(null);

  const products = suggestions.products;

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      setHighlightedIndex(-1);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (value.trim().length >= MIN_QUERY_LENGTH) {
        debounceRef.current = setTimeout(() => {
          setHasSearched(true);
          setShowDropdown(true);
          getSuggestions(value, locale);
        }, DEBOUNCE_MS);
      } else {
        setShowDropdown(false);
        setHasSearched(false);
      }
    },
    [getSuggestions, locale],
  );

  const handleSelect = useCallback(
    async (product: Product) => {
      setQuery('');
      setShowDropdown(false);
      setHasSearched(false);
      setHighlightedIndex(-1);

      try {
        const price = await fetchProductPrice(product.id, undefined, undefined, sessionCurrency);
        if (!price) {
          toast({
            title: t('notifications.productsCouldNotBeAdded', { count: 1 }),
            description: product.sku ?? product.id,
            variant: 'destructive',
            persistent: true,
          });
          inputRef.current?.focus();
          return;
        }

        // Check availability
        const code = product.sku ?? product.id;
        try {
          const availability = await fetchProductAvailability(product.id);
          if (!availability.isAvailable || availability.availableQuantity <= 0) {
            toast({
              title: t('notifications.insufficientStock', {
                code,
                requested: 1,
                available: 0,
              }),
              variant: 'warning',
            });
            inputRef.current?.focus();
            return;
          }
        } catch {
          // If availability check fails, allow the product through
        }

        onAddProducts([{ product: { ...product, price }, quantity: 1 }]);
      } catch (err) {
        logger.error({ err, productId: product.id }, 'Failed to fetch price for selected product');
        toast({
          title: t('notifications.productsCouldNotBeAdded', { count: 1 }),
          description: product.sku ?? product.id,
          variant: 'destructive',
          persistent: true,
        });
      }

      inputRef.current?.focus();
    },
    [onAddProducts, toast, t, logger, sessionCurrency],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown || products.length === 0) {
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < products.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : products.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < products.length) {
            handleSelect(products[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowDropdown(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [showDropdown, products, highlightedIndex, handleSelect],
  );

  // Dismiss dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-surface-page rounded-md p-6 shadow-sm flex flex-col gap-4 items-end">
      <H5 className="mb-0 self-start w-full">{t('tabs.addManually')}</H5>
      <div className="flex flex-col sm:flex-row gap-6 self-stretch">
        <div ref={containerRef} className={cn('relative flex-1 min-w-0 sm:border-r sm:border-border-primary sm:pr-6')}>
          <label htmlFor={SEARCH_INPUT_ID} className="font-bold text-base mb-1 block">
            {t('search.label')}
          </label>
          <p id={SEARCH_HINT_ID} className="text-[12px] leading-5 text-text-placeholders mb-2">
            {t('search.hint')}
          </p>
          <div className="relative">
            <Input
              id={SEARCH_INPUT_ID}
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={t('search.placeholder')}
              className="pr-10"
              role="combobox"
              aria-expanded={showDropdown}
              aria-haspopup="listbox"
              aria-autocomplete="list"
              aria-controls="quick-order-search-results"
              aria-describedby={SEARCH_HINT_ID}
              autoComplete="off"
              data-testid="quick-order-search-input"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-placeholders pointer-events-none" />

            {showDropdown && (
              <QuickOrderSearchDropdown
                ref={dropdownRef}
                products={products}
                loading={loading}
                hasSearched={hasSearched}
                highlightedIndex={highlightedIndex}
                onSelect={handleSelect}
              />
            )}
          </div>
        </div>

        <QuickOrderTextPaste
          ref={textPasteRef}
          onAddProducts={onAddProducts}
          onResolvingChange={setTextPasteResolving}
          onTextChange={setTextPasteHasText}
          onValidationChange={setTextPasteHasErrors}
        />
      </div>

      <Button
        onClick={() => textPasteRef.current?.addToList()}
        disabled={textPasteResolving || !textPasteHasText || textPasteHasErrors}
        className="w-full sm:w-auto sm:min-w-[216px] h-12 font-headlines tracking-[2px]"
        data-testid="quick-order-add-to-list-button"
      >
        {textPasteResolving ? (
          <>
            <Spinner variant="sm" color="white" />
            <span className="ml-2">{t('search.addProducts')}</span>
          </>
        ) : (
          <>
            {t('search.addProducts')}
            <Plus className="ml-2 h-5 w-5" />
          </>
        )}
      </Button>
    </div>
  );
}
