import type { Dispatch, SetStateAction } from 'react';
import React from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/h';
import type { SearchSuggestions } from '@/platform/services/model/search';

export interface NoResultsProps {
  queryCompletions: SearchSuggestions['queryCompletions'];
  setQuery: Dispatch<SetStateAction<string>>;
  onQuerySelect?: (query: string) => void;
}

export function NoResults({ queryCompletions, setQuery, onQuerySelect }: NoResultsProps) {
  const t = useTranslations('layout.header');

  return (
    <div className="whitespace-normal col-span-full">
      <Heading variant="h5" className="pb-6">
        {t('noResults')}
      </Heading>
      <p className="text-base pb-6">{t('doubleCheck')}</p>
      <p className="text-base">{t('commonSearch')}</p>
      {queryCompletions && (
        <div className="flex flex-wrap gap-4 mt-6">
          {queryCompletions.map((completion) => (
            <Button
              onClick={() => {
                setQuery(completion);
                if (onQuerySelect) {
                  onQuerySelect(completion);
                }
              }}
              key={completion}
              className="min-w-0 p-2 bg-surface-disabled hover:bg-surface-hover-grey text-text-heading flex shrink-1"
            >
              <Search />
              <span className="truncate w-full max-w-full text-left sm:max-w-[48ch]"> {completion}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export default NoResults;
