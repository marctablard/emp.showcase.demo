import { ChangeEvent, FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ListFilter, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { FilterValue as SearchFilterValue } from '@/hooks/search/useSearch';
import { Filter } from '@/platform/services/model/common';
import { getMinMaxValues, isNumberRange, isSelect } from './util/search';

interface SearchFilterProps {
  availableFilters: Filter[];
  activeFilters: Record<string, SearchFilterValue>;
  applyFacet: (facetId: string, value: string | string[]) => void;
  applyRangeFacet: (facetId: string, min: string, max: string) => void;
  applyAllFacets: (
    facets: Array<{ facetId: string; value: string | string[] } | { facetId: string; min: string; max: string }>,
  ) => void;
  resetFacet: (facetId: string) => void;
  resetAllFacets: () => void;
  onSubmitComplete?: () => void;
}

type FilterFormValues = Record<string, string | number>;

interface ActiveFiltersProps {
  activeFilters: Record<string, SearchFilterValue>;
  resetFacet: (facetId: string) => void;
  resetAllFacets: () => void;
}

function ActiveFilters({ activeFilters, resetFacet }: ActiveFiltersProps) {
  const t = useTranslations('product');
  const filters = Object.entries(activeFilters);

  // Helper function to format filter values for display
  const formatFilterValue = (value: SearchFilterValue): string => {
    if (typeof value === 'string') {
      return value;
    } else if (Array.isArray(value)) {
      return value.join(', ');
    } else if (value && typeof value === 'object') {
      // Handle Record<string, string>
      return Object.entries(value)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
    }
    return '';
  };

  return (
    <>
      {filters &&
        filters.map(([id, value]) => {
          return (
            <Button
              onClick={() => resetFacet(id)}
              className="bg-surface-disabled text-text-headings border-none normal-case"
              variant="secondary"
              key={id}
            >
              {t(`filters.${id}`)} ({formatFilterValue(value)})
              <X />
            </Button>
          );
        })}
    </>
  );
}

function FilterMenu({ availableFilters, activeFilters, applyAllFacets, onSubmitComplete }: SearchFilterProps) {
  const t = useTranslations('product');

  // State to store form values
  const [formValues, setFormValues] = useState<FilterFormValues>(() => {
    // Initialize with default values from active filters
    const initialValues: FilterFormValues = {};

    availableFilters.forEach(({ values, id, name }) => {
      if (isSelect(name || '')) {
        // Use active filter value if available, otherwise empty string
        const activeValue = activeFilters[id];
        initialValues[id] = activeValue ? String(activeValue) : '';
      } else if (isNumberRange(values)) {
        // Set min/max values for range filters
        const [min, max] = getMinMaxValues(values);

        // Check if there's an active range filter
        const activeRange = activeFilters[id] as { from: string; till: string } | undefined;

        if (activeRange) {
          // Use active filter range values
          initialValues[`${id}_min`] = Number(activeRange.from);
          initialValues[`${id}_max`] = Number(activeRange.till);
        } else {
          // Use default min/max values
          initialValues[`${id}_min`] = min;
          initialValues[`${id}_max`] = max;
        }
      }
    });

    return initialValues;
  });

  // Handle input changes
  const handleInputChange = (id: string, value: string | number) => {
    setFormValues((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  // Handle slider changes
  const handleSliderChange = (id: string, values: number[]) => {
    setFormValues((prev) => ({
      ...prev,
      [`${id}_min`]: values[0],
      [`${id}_max`]: values[1],
    }));
  };

  // Handle select changes
  const handleSelectChange = (id: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  // Submit handler to apply all filters at once
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      // Collect all filters to apply in a single API call
      const filtersToApply: Array<
        { facetId: string; value: string | string[] } | { facetId: string; min: string; max: string }
      > = [];

      availableFilters.forEach(({ id, name, values }) => {
        if (isSelect(name || '')) {
          // Collect select filters
          const value = formValues[id] as string;
          // Only include filter if value is not empty
          if (value && value !== '') {
            filtersToApply.push({
              facetId: id,
              value: value,
            });
          }
        } else if (isNumberRange(values)) {
          // Collect range filters
          const [defaultMin, defaultMax] = getMinMaxValues(values);
          const minValue = Number(formValues[`${id}_min`]);
          const maxValue = Number(formValues[`${id}_max`]);

          // Only add filter if values are different from default min/max
          const isDefault = minValue === defaultMin && maxValue === defaultMax;

          if (!isDefault && minValue !== undefined && maxValue !== undefined) {
            filtersToApply.push({
              facetId: id,
              min: String(minValue),
              max: String(maxValue),
            });
          }
        }
      });

      // Apply all filters in a single API call
      if (filtersToApply.length > 0) {
        applyAllFacets(filtersToApply);
      }

      // Close the popover after submitting
      if (onSubmitComplete) {
        onSubmitComplete();
      }
    } catch (error) {
      console.error('Error applying filters:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {availableFilters.map(({ id, values, name }) => {
        if (!isSelect(name || '')) {
          const [min, max] = getMinMaxValues(values);
          const minValue = formValues[`${id}_min`] !== undefined ? Number(formValues[`${id}_min`]) : min;
          const maxValue = formValues[`${id}_max`] !== undefined ? Number(formValues[`${id}_max`]) : max;

          return (
            <div key={id} className="space-y-2">
              <Label>{t(`filters.${name}`)}</Label>
              <div className="grid grid-cols-2 gap-2">
                {['min', 'max'].map((input) => {
                  const inputId = `${id}_${input}`;
                  const inputValue = input === 'min' ? minValue : maxValue;

                  return (
                    <div key={inputId}>
                      <Input
                        type="number"
                        placeholder={input.toUpperCase()}
                        value={inputValue}
                        min={min}
                        max={max}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          handleInputChange(inputId, e.target.value);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <Slider
                value={[Number(minValue), Number(maxValue)]}
                min={min}
                max={max}
                step={1}
                className="mt-2"
                onValueChange={(values: number[]) => {
                  handleSliderChange(id, values);
                }}
              />
            </div>
          );
        }

        // Select filter type
        if (isSelect(name || '')) {
          return (
            <div key={id} className="space-y-2">
              <Label>{t(`filters.${name}`)}</Label>
              <Select
                value={formValues[id] as string}
                onValueChange={(value) => {
                  handleSelectChange(id, value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t(`filters.${name}`)} />
                </SelectTrigger>
                <SelectContent>
                  {values.map((value) => (
                    <SelectItem key={value.id} value={value.id}>
                      {value.name} ({value.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        return null;
      })}

      {/* Submit button */}
      <Button type="submit" className="w-full mt-4">
        {t('filters.applyFilters')}
      </Button>
    </form>
  );
}

function SearchFilter({
  availableFilters,
  applyFacet,
  applyRangeFacet,
  applyAllFacets,
  resetFacet,
  resetAllFacets,
  activeFilters,
}: SearchFilterProps) {
  const t = useTranslations('product');
  // Check if there are any active filters
  const hasActiveFilters = Object.keys(activeFilters).length > 0;
  // State to control if the filter offcanvas is visible
  const [showFilterOffcanvas, setShowFilterOffcanvas] = useState(false);

  // Toggle filter offcanvas visibility
  const toggleFilterOffcanvas = () => {
    setShowFilterOffcanvas(!showFilterOffcanvas);
  };

  return (
    <div className="relative w-full">
      {/* Filter Toggle Button */}
      <div className="flex gap-4 max-w-full overflow-x-scroll hide-scrollbar mb-4">
        <Button variant="secondary" onClick={toggleFilterOffcanvas}>
          <ListFilter className="mr-2" /> Filter
        </Button>

        <ActiveFilters activeFilters={activeFilters} resetFacet={resetFacet} resetAllFacets={resetAllFacets} />
        {hasActiveFilters && (
          <Button variant="neutral" onClick={resetAllFacets} className="normal-case">
            <Trash2 className="mr-1" />
            {t('filters.clearFilter')}
          </Button>
        )}
      </div>

      {/* Offcanvas Filter Menu - shown when toggled */}
      {showFilterOffcanvas && (
        <>
          {/* Backdrop - closes the filter when clicked */}
          <div className="fixed inset-0 z-40" onClick={toggleFilterOffcanvas} aria-hidden="true" />

          {/* Offcanvas Panel */}
          <div className="fixed left-0 top-10 h-[calc(100%-40px)] max-w-[590px] w-full bg-surface-page p-6 z-50 overflow-y-auto border rounded-sm shadow-sm">
            <div className="flex justify-end mb-4 -mr-4 -mt-4">
              <Button variant="link" size="icon" onClick={toggleFilterOffcanvas} className="text-black">
                <X />
              </Button>
            </div>

            <FilterMenu
              {...{
                availableFilters,
                applyFacet,
                applyRangeFacet,
                applyAllFacets,
                resetAllFacets,
                resetFacet,
                activeFilters,
                onSubmitComplete: toggleFilterOffcanvas,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export { SearchFilter };
