import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDownAZ, ArrowDownZA } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SearchSortOption } from '@/platform/services/model/common';
import { resolveNextSortForOption, resolveSearchSortSelection, resolveToggledSort } from './search-sort.helpers';

const CLEAR_SORT_VALUE = '__clear_sort__';

interface SearchSortProps {
  availableSorts?: SearchSortOption[];
  currentSort?: string;
  onChangeSort?: (sort?: string) => void;
  changeSort?: (sort?: string) => void;
}

export function SearchSort({ availableSorts = [], currentSort, onChangeSort, changeSort }: SearchSortProps) {
  const t = useTranslations('search.sort');

  const options = useMemo(() => {
    return availableSorts.map((sort) => {
      const label = sort.label || (sort.labelKey ? t(sort.labelKey as any) : sort.id);
      return { ...sort, displayLabel: label };
    });
  }, [availableSorts, t]);

  if (!options || options.length === 0) return null;

  const selection = resolveSearchSortSelection(currentSort);
  const activeOption = selection
    ? options.find(
        (option) => option.id === selection.id && option.directions.includes(selection.direction as 'asc' | 'desc'),
      )
    : undefined;
  const selectedOptionId = activeOption?.id ?? '';
  const isAscending = selection?.direction === 'asc';
  const hasActiveSort = !!selection && !!activeOption;

  const fireChange = (sort?: string) => {
    if (onChangeSort) onChangeSort(sort);
    else if (changeSort) changeSort(sort);
  };

  const handleSelectChange = (value: string) => {
    if (value === CLEAR_SORT_VALUE) {
      fireChange(undefined);
      return;
    }

    const selectedOption = options.find((opt) => opt.id === value);
    if (!selectedOption) return;
    fireChange(resolveNextSortForOption(selectedOption, currentSort));
  };

  const handleDirectionToggle = () => {
    const newSort = resolveToggledSort(currentSort);
    if (newSort) fireChange(newSort);
  };

  return (
    <div className="flex w-full items-center gap-2">
      <Select value={selectedOptionId} onValueChange={handleSelectChange}>
        <SelectTrigger>
          <SelectValue placeholder={t('placeholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CLEAR_SORT_VALUE}>{t('clear')}</SelectItem>
          <SelectSeparator />
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.displayLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasActiveSort && (
        <Button
          variant="secondary"
          size="icon"
          onClick={handleDirectionToggle}
          aria-label={isAscending ? t('direction.asc') : t('direction.desc')}
        >
          {isAscending ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowDownZA className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}
