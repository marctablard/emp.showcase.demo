import React from 'react';
import { useTranslations } from 'next-intl';
import { History, Search, Sparkles } from 'lucide-react';
import { ProductTileFlyOut } from '@/components/product/product-tile-fly-out';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/h';
import UiLink from '@/components/ui/link';
import { Skeleton } from '@/components/ui/skeleton';
import useHistory from '@/hooks/history/useHistory';
import { useSearchPreview } from '@/hooks/search/useSearchPreview';
import { MAX_PREVIEW_PRODUCTS } from '@/lib/search/search-preview';

const MAX_RECENT_SEARCHES = 6;

const CHIP_CLASS =
  'min-w-0 p-2 border-width-pills rounded-pills bg-surface-disabled hover:bg-surface-hover-grey normal-case text-text-heading flex shrink-1 font-medium';

export interface SearchPreviewProps {
  /** Keyword chips (recent / suggested searches): fill the input and show live suggestions. */
  onQuerySelect: (query: string) => void;
  /** Natural-language examples: run the full search directly, which interprets the sentence. */
  onSearchSubmit: (query: string) => void;
  onProductClick?: () => void;
}

function QueryChip({
  query,
  icon,
  testId,
  onClick,
}: {
  query: string;
  icon: React.ReactNode;
  testId: string;
  onClick: (query: string) => void;
}) {
  return (
    <Button type="button" onClick={() => onClick(query)} className={CHIP_CLASS} data-testid={testId}>
      {icon}
      <span className="truncate w-full max-w-full text-left sm:max-w-[48ch]">{query}</span>
    </Button>
  );
}

/** Zero-query content of the header search fly-out: shown on open, before the shopper types. */
export function SearchPreview({ onQuerySelect, onSearchSubmit, onProductClick }: SearchPreviewProps) {
  const t = useTranslations('layout.header.searchPreview');
  const tHeader = useTranslations('layout.header');
  const { searchHistory, clearSearchHistory } = useHistory();
  const { preview, loading } = useSearchPreview(true);
  const recentSearches = [...searchHistory].reverse().slice(0, MAX_RECENT_SEARCHES);
  const exampleQueries = [t('examples.example1'), t('examples.example2'), t('examples.example3')];

  return (
    <div className="col-span-5 flex flex-col gap-6 mb-2" data-testid="headerSearch-preview">
      {recentSearches.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <Heading variant="h5" as="div">
              {t('recentSearches')}
            </Heading>
            <UiLink
              type="Button"
              className="text-text-heading font-medium"
              onClick={clearSearchHistory}
              data-testid="headerSearch-clearHistory"
            >
              {tHeader('clearHistory')}
            </UiLink>
          </div>
          <div className="flex flex-wrap gap-4">
            {recentSearches.map((query, index) => (
              <QueryChip
                key={query}
                query={query}
                icon={<History />}
                testId={`headerSearch-recentQuery-${index}`}
                onClick={onQuerySelect}
              />
            ))}
          </div>
        </div>
      )}

      {preview.queryCompletions.length > 0 && (
        <div className="flex flex-col gap-3">
          <Heading variant="h5" as="div">
            {t('suggestedSearches')}
          </Heading>
          <div className="flex flex-wrap gap-4">
            {preview.queryCompletions.map((query, index) => (
              <QueryChip
                key={query}
                query={query}
                icon={<Search />}
                testId={`headerSearch-suggestedQuery-${index}`}
                onClick={onQuerySelect}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Heading variant="h5" as="div">
          {t('tryAsking')}
        </Heading>
        <div className="flex flex-wrap gap-4">
          {exampleQueries.map((query, index) => (
            <QueryChip
              key={query}
              query={query}
              icon={<Sparkles />}
              testId={`headerSearch-exampleQuery-${index}`}
              onClick={onSearchSubmit}
            />
          ))}
        </div>
      </div>

      {(loading || preview.products.length > 0) && (
        <div className="flex flex-col gap-3">
          <Heading variant="h5" as="div">
            {preview.source === 'history' ? t('recommendedForYou') : t('popularProducts')}
          </Heading>
          <div className="grid auto-rows-max grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {loading
              ? Array.from({ length: MAX_PREVIEW_PRODUCTS }, (_, index) => (
                  <Skeleton key={index} className="h-28 w-full" />
                ))
              : preview.products.map((product) => (
                  <ProductTileFlyOut key={product.id} product={product} onProductClick={onProductClick} />
                ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchPreview;
