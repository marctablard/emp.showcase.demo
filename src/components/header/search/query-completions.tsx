import React, { Dispatch, SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { History } from 'lucide-react';
import MarkedText from '@/components/header/search/marked-text';
import { Button } from '@/components/ui/button';
import UiLink from '@/components/ui/link';
import useHistory from '@/hooks/history/useHistory';

export interface QueryCompletionsProps {
  isProductsShown: boolean;
  queryCompletions: string[];
  setQuery: Dispatch<SetStateAction<string>>;
  onQuerySelect?: (query: string) => void;
  query: string;
}

export function QueryCompletions({
  isProductsShown,
  queryCompletions,
  setQuery,
  onQuerySelect,
  query,
}: QueryCompletionsProps) {
  const { searchHistory, clearSearchHistory } = useHistory();
  const completions = isProductsShown ? queryCompletions : searchHistory;
  const t = useTranslations('layout.header');

  return (
    completions.length > 0 && (
      <div id="query-completions" className="col-span-5 flex flex-wrap gap-4 mb-2">
        {completions.map((queryCompletion) => (
          <Button
            onClick={() => {
              setQuery(queryCompletion);
              if (onQuerySelect) {
                onQuerySelect(queryCompletion);
              }
            }}
            key={queryCompletion}
            className="min-w-0 p-2 bord border-width-pills rounded-pills bg-surface-disabled hover:bg-surface-hover-grey normal-case text-text-heading flex shrink-1 font-medium"
          >
            {isProductsShown ? (
              <span className="truncate w-full max-w-full text-left sm:max-w-[48ch]">
                <MarkedText text={queryCompletion} keyword={query} />
              </span>
            ) : (
              <>
                <History />
                <span className="truncate w-full max-w-full text-left sm:max-w-[48ch]">{queryCompletion}</span>
              </>
            )}
          </Button>
        ))}

        {!isProductsShown && (
          <UiLink type="Button" className="text-text-heading font-medium" onClick={clearSearchHistory}>
            {t('clearHistory')}
          </UiLink>
        )}
      </div>
    )
  );
}

export default QueryCompletions;
