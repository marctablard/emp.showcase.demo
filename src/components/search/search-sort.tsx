import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SearchSortOption } from '@/platform/services/model/common';

interface SearchSortProps {
  availableSorts?: SearchSortOption[];
  currentSort?: string;
  onChangeSort?: (sort?: string) => void;
  changeSort?: (sort?: string) => void;
}

export function SearchSort({ availableSorts = [], currentSort, onChangeSort, changeSort }: SearchSortProps) {
  const t = useTranslations('search.sort');

  const options = useMemo(() => {
    return availableSorts.flatMap((sort) => {
      const label = sort.label || (sort.labelKey ? t(sort.labelKey as any) : sort.id);

      return sort.directions.map((dir) => ({
        id: `${sort.id}:${dir}`,
        // Sanitize to a CSS-selector-safe subset so unquoted attribute selectors in tests stay robust
        // (sort ids can contain `:`, `.`, `{`, `}`, e.g. `_product_i18n.{locale}.name`).
        testId: `${sort.id}-${dir}`.replace(/[^a-zA-Z0-9_-]+/g, '-'),
        displayLabel: `${label} ${t(`direction.${dir}`)}`,
      }));
    });
  }, [availableSorts, t]);

  if (!options || options.length === 0) return null;

  const selectedOptionId = options.some((opt) => opt.id === currentSort) ? (currentSort as string) : '';

  const fireChange = (sort?: string) => {
    if (onChangeSort) onChangeSort(sort);
    else if (changeSort) changeSort(sort);
  };

  const handleSelectChange = (value: string) => {
    fireChange(value);
  };

  return (
    <div className="flex w-full items-center gap-2" data-testid="search-sort">
      <Select value={selectedOptionId} onValueChange={handleSelectChange}>
        <SelectTrigger data-testid="search-sort-trigger">
          <SelectValue placeholder={t('placeholder')} />
        </SelectTrigger>
        <SelectContent data-testid="search-sort-content">
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id} data-testid={`search-sort-option-${opt.testId}`}>
              {opt.displayLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
