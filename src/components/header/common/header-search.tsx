'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { useHeaderSearch } from '@/components/header/search/search-context';
import { SearchFlyOut } from '@/components/header/search/search-fly-out';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSearch } from '@/hooks/search/useSearch';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { Product } from '@/platform/services/model/product';

export interface HeaderSearchProps {
  small?: boolean;
  show?: boolean;
  isCollapsedHeader?: boolean;
  className?: string;
}

export function HeaderSearch({ small, show, isCollapsedHeader, className }: HeaderSearchProps) {
  small = small || false;
  const t = useTranslations('layout.header');
  const router = useRouter();
  const { activateSearch, deactivateSearch, showSearch, hasInputFocus } = useHeaderSearch();

  // Get the current locale
  const locale = useLocale();

  // Initialize the search hook with Product type and initial results
  const { data: _products, suggestions, loading, getSuggestions, currentQuery } = useSearch<Product>();

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasInitialSearch, setHasInitialSearch] = useState(Boolean(currentQuery));
  const [isClient, setIsClient] = useState(false);
  const [query, setQuery] = useState(currentQuery || '');

  const inputTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // @see https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (hasInputFocus) {
      const raf = requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [hasInputFocus]);

  // redirect to /browse with the search terms
  const redirectToBrowse = (e?: React.FormEvent) => {
    e?.preventDefault();
    deactivateSearch();
    setShowSuggestions(false);
    router.push(`/browse?q=${query}`);
    inputRef.current?.blur();
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    activateSearch();

    if (inputTimeoutRef.current) {
      clearTimeout(inputTimeoutRef.current);
    }

    inputTimeoutRef.current = setTimeout(() => {
      // Fetch suggestions only when at least 2 characters are entered
      if (value.trim().length >= 2) {
        setShowSuggestions(true);
        setHasInitialSearch(true);
        getSuggestions(value, locale);
      } else {
        setShowSuggestions(false);
      }
    }, 360);
  };

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      // Check if the click is outside both the input field and suggestions component
      if (
        formRef.current &&
        !formRef.current.contains(event.target as Node) &&
        (!showSuggestions || (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)))
      ) {
        deactivateSearch();
        setShowSuggestions(false);
      }
    },
    [formRef, suggestionsRef, showSuggestions, deactivateSearch],
  );

  // Function to close the flyout when a product is clicked
  const handleProductClick = useCallback(() => {
    deactivateSearch();
    setShowSuggestions(false);
  }, [deactivateSearch]);

  // Function to handle query selection from suggestions
  const handleQuerySelect = useCallback(
    (selectedQuery: string) => {
      // Update the query state
      setQuery(selectedQuery);
      setHasInitialSearch(true);

      // Execute the search with the selected query
      getSuggestions(selectedQuery, locale);
    },
    [getSuggestions, locale],
  );

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClickOutside]);

  // SSR-Fallback
  if (!isClient) {
    return (
      <div className="z-50 relative transition-opacity transition-discrete duration-200 w-full hidden opacity-0 md:block md:opacity-100 max-w-80 lg:max-w-180">
        <div className="relative flex items-center">
          <div className="w-full h-full relative">
            <div className="flex w-full min-w-0 px-3 rounded-form-field h-11 py-2 pl-6 pr-[62px] bg-surface-search-input hover:bg-surface-search-input border border-transparent">
              {/* Skeleton */}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'z-50 relative transition-opacity transition-discrete duration-200 w-full hidden opacity-0 md:block md:opacity-100',
        showSearch || show ? 'block opacity-100' : '',
        hasInputFocus ? 'backdrop-active' : small ? 'max-w-80' : 'max-w-180',
        className,
      )}
    >
      <form ref={formRef} onSubmit={(e) => redirectToBrowse(e)} className="relative flex items-center">
        <Input
          placeholder={small ? t('shortSearch') : t('search')}
          value={query}
          onChange={handleInput}
          onFocus={handleInput}
          ref={inputRef}
          id="search-input"
          onKeyDown={(e) => e.key === 'Enter' && redirectToBrowse(e)}
          className={`h-11 py-2 pl-6 pr-[62px] placeholder:text-text-placeholders text-text-headings bg-surface-search-input hover:bg-surface-search-input border border-transparent hover:border-border-action-hover ${hasInputFocus ? 'shadow-md' : ''}`}
          data-testid="header-searchInput"
        />

        <Button
          type="submit"
          title={t('searchButton')}
          className={`absolute ${hasInputFocus ? 'right-13' : 'right-0'} top-1/2 -translate-y-1/2 bg-transparent pr-6 cursor-pointer`}
          variant={'link'}
          aria-label={t('searchProducts')}
          data-testid="header-searchButton"
        >
          <Search className="text-icon-primary-dark" width="28" height="28" />
        </Button>

        {hasInputFocus && (
          <Button
            type="button"
            variant={'link'}
            onClick={() => {
              setShowSuggestions(false);
              deactivateSearch();
            }}
            className="cursor-pointer z-30"
            data-testid="header-searchClose"
          >
            <X className="text-icon-primary-dark" width="28" height="28" />
          </Button>
        )}
      </form>
      {show && showSuggestions && hasInitialSearch && (
        <SearchFlyOut
          ref={suggestionsRef}
          suggestions={suggestions}
          hasInitialSearch={hasInitialSearch}
          loading={loading}
          query={query}
          setQuery={setQuery}
          onProductClick={handleProductClick}
          onQuerySelect={handleQuerySelect}
          redirectToBrowse={redirectToBrowse}
          isCollapsedHeader={isCollapsedHeader}
        />
      )}
    </div>
  );
}
