'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { SearchActiveFilters } from '@/components/search/search-active-filters';
import { SearchActiveFiltersWithReset } from '@/components/search/search-active-filters-with-reset';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RatingStar } from '@/components/ui/rating';
import { Slider } from '@/components/ui/slider';
import { getPublicFacetsDefaultCollapseSize } from '@/lib/common/public-default-env';
import { cn } from '@/lib/utils';
import { BATTERY_INCLUDED_BREADCRUMB_FILTER } from '@/platform/services/model/category/batteryincluded-category';
import type {
  BatteryIncludedFacet,
  BatteryIncludedTreeFacetOption,
  SearchFilterValue,
} from '@/platform/services/model/common';
import { getActiveFacetValues } from '../util/merge-active-filter-facet-options';
import { getFilterLabelFallback } from '../util/search';

interface PlpFacetPanelProps {
  facets?: BatteryIncludedFacet[];
  activeFilters: Record<string, SearchFilterValue>;
  applyFacet: (facetId: string, value: string | string[]) => void;
  applyRangeFacet: (facetId: string, min: string, max: string) => void;
  resetFacet: (facetId: string) => void;
  resetAllFacets?: () => void;
  categoryFilterLabelsById?: Record<string, string>;
  className?: string;
  onClose?: () => void;
  variant?: 'card' | 'list';
}

interface FacetToggleRendererProps {
  facetId: string;
  activeFilters: Record<string, SearchFilterValue>;
  applyFacet: (facetId: string, value: string | string[]) => void;
  resetFacet: (facetId: string) => void;
}

interface TreeNode {
  key: string;
  id: string;
  label: string;
  option?: BatteryIncludedTreeFacetOption;
  children: TreeNode[];
}

interface CollapsibleFacetOptionsState {
  canToggle: boolean;
  isExpanded: boolean;
  visibleCount: number;
  collapseButtonLabel: string;
  toggleExpanded: () => void;
}

function getSelectedChoiceCount(facet: BatteryIncludedFacet, activeFilters: Record<string, SearchFilterValue>): number {
  if (facet.kind === 'range') {
    return 0;
  }

  return getActiveFacetValues(activeFilters[facet.id]).length;
}

function getRangeFacetValue(value: SearchFilterValue | undefined): { from?: string; till?: string } | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const from = typeof value.from === 'string' ? value.from : undefined;
  const till = typeof value.till === 'string' ? value.till : undefined;

  if (!from && !till) {
    return undefined;
  }

  return { from, till };
}

function toggleFacetValue(
  currentValue: SearchFilterValue | undefined,
  nextValue: string,
): string | string[] | undefined {
  const activeValues = getActiveFacetValues(currentValue);

  if (activeValues.includes(nextValue)) {
    const remainingValues = activeValues.filter((value) => value !== nextValue);

    if (remainingValues.length === 0) {
      return undefined;
    }

    return remainingValues.length === 1 ? remainingValues[0] : remainingValues;
  }

  if (activeValues.length === 0) {
    return nextValue;
  }

  return [...activeValues, nextValue];
}

function buildTreeNodes(options: BatteryIncludedTreeFacetOption[]): TreeNode[] {
  const rootNodes: TreeNode[] = [];
  const nodeIndex = new Map<string, TreeNode>();

  options.forEach((option) => {
    let parentChildren = rootNodes;

    option.idPath.forEach((pathId, index) => {
      const key = option.idPath.slice(0, index + 1).join('>');
      const existingNode = nodeIndex.get(key);

      if (existingNode) {
        parentChildren = existingNode.children;
        if (index === option.idPath.length - 1) {
          existingNode.option = option;
        }
        return;
      }

      const nextNode: TreeNode = {
        key,
        id: pathId,
        label: option.labelPath[index] ?? pathId,
        option: index === option.idPath.length - 1 ? option : undefined,
        children: [],
      };

      nodeIndex.set(key, nextNode);
      parentChildren.push(nextNode);
      parentChildren = nextNode.children;
    });
  });

  return rootNodes;
}

function useCollapsibleFacetOptions(optionCount: number, facetLabel: string): CollapsibleFacetOptionsState {
  const tFacetToggle = useTranslations('search.plpCategoryTree');
  const collapseSize = getPublicFacetsDefaultCollapseSize();
  const canToggle = optionCount > collapseSize;
  const [isExpanded, setIsExpanded] = useState(false);

  const resolvedIsExpanded = canToggle && isExpanded;

  return {
    canToggle,
    isExpanded: resolvedIsExpanded,
    visibleCount: canToggle && !resolvedIsExpanded ? collapseSize : optionCount,
    collapseButtonLabel: resolvedIsExpanded
      ? tFacetToggle('collapse', { name: facetLabel })
      : tFacetToggle('expand', { name: facetLabel }),
    toggleExpanded: () => {
      if (!canToggle) {
        return;
      }

      setIsExpanded((currentValue) => !currentValue);
    },
  };
}

function FacetOptionToggle({
  facetId,
  listId,
  label,
  isExpanded,
  onToggle,
}: {
  facetId: string;
  listId: string;
  label: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="focus-visible:ring-border-focus self-start text-sm font-bold text-text-action underline-offset-4 transition hover:text-text-action-hover hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      aria-controls={listId}
      aria-expanded={isExpanded}
      data-testid={`facet-options-toggle-${facetId}`}
      onClick={onToggle}
    >
      {label}
    </button>
  );
}

function PlpFacetCheckboxRow({
  facetId,
  option,
  checked,
  onToggle,
  leadingContent,
  inlineLeadingContent,
  className,
}: {
  facetId: string;
  option: { id: string; label: string; count?: number };
  checked: boolean;
  onToggle: () => void;
  leadingContent?: React.ReactNode;
  inlineLeadingContent?: boolean;
  className?: string;
}) {
  const inputId = `${facetId}-${option.id}`;

  return (
    <label htmlFor={inputId} className={cn('flex cursor-pointer items-center gap-3 pl-1', className)}>
      <Checkbox id={inputId} checked={checked} onCheckedChange={onToggle} aria-label={option.label} />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <div
          className={cn(
            'flex min-w-0 text-left',
            leadingContent ? (inlineLeadingContent ? 'items-center gap-3' : 'flex-col gap-1') : 'items-center',
          )}
        >
          {leadingContent}
          <span className="truncate text-base font-normal text-text-body" title={option.label}>
            {option.label}
          </span>
        </div>
        {typeof option.count === 'number' ? (
          <span className="shrink-0 text-sm text-text-secondary">({option.count})</span>
        ) : null}
      </div>
    </label>
  );
}

function SelectFacetRenderer({
  facet,
  activeFilters,
  applyFacet,
  resetFacet,
}: FacetToggleRendererProps & { facet: Extract<BatteryIncludedFacet, { kind: 'select' }> }) {
  const optionListId = `${facet.id}-options`;
  const collapsibleOptions = useCollapsibleFacetOptions(
    facet.options.length,
    facet.label || getFilterLabelFallback(facet.id),
  );
  const visibleOptions = facet.options.slice(0, collapsibleOptions.visibleCount);

  return (
    <div className="flex flex-col gap-4">
      <ul id={optionListId} className="flex flex-col gap-3 py-1" role="list">
        {visibleOptions.map((option) => {
          const checked = getActiveFacetValues(activeFilters[facet.id]).includes(option.id);

          return (
            <li key={option.id}>
              <PlpFacetCheckboxRow
                facetId={facet.id}
                option={option}
                checked={checked}
                onToggle={() => {
                  const nextValue = toggleFacetValue(activeFilters[facet.id], option.id);

                  if (nextValue === undefined) {
                    resetFacet(facet.id);
                    return;
                  }

                  applyFacet(facet.id, nextValue);
                }}
              />
            </li>
          );
        })}
      </ul>
      {collapsibleOptions.canToggle ? (
        <FacetOptionToggle
          facetId={facet.id}
          listId={optionListId}
          label={collapsibleOptions.collapseButtonLabel}
          isExpanded={collapsibleOptions.isExpanded}
          onToggle={collapsibleOptions.toggleExpanded}
        />
      ) : null}
    </div>
  );
}

function TreeFacetBranch({
  facetId,
  activeFilters,
  applyFacet,
  resetFacet,
  nodes,
}: FacetToggleRendererProps & { nodes: TreeNode[] }) {
  return (
    <ul className="flex flex-col gap-3 py-1" role="list">
      {nodes.map((node) => {
        const option = node.option;
        const checked = option ? getActiveFacetValues(activeFilters[facetId]).includes(option.id) : false;

        return (
          <li key={node.key}>
            {option ? (
              <PlpFacetCheckboxRow
                facetId={facetId}
                option={option}
                checked={checked}
                onToggle={() => {
                  const nextValue = toggleFacetValue(activeFilters[facetId], option.id);

                  if (nextValue === undefined) {
                    resetFacet(facetId);
                    return;
                  }

                  applyFacet(facetId, nextValue);
                }}
                className={node.children.length > 0 ? 'pb-1' : undefined}
              />
            ) : (
              <span className="block text-sm font-medium text-text-headings">{node.label}</span>
            )}
            {node.children.length > 0 ? (
              <div className="border-border-primary ml-6 mt-3 border-l pl-4">
                <TreeFacetBranch
                  facetId={facetId}
                  activeFilters={activeFilters}
                  applyFacet={applyFacet}
                  resetFacet={resetFacet}
                  nodes={node.children}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function TreeFacetRenderer({
  facet,
  activeFilters,
  applyFacet,
  resetFacet,
}: FacetToggleRendererProps & { facet: Extract<BatteryIncludedFacet, { kind: 'tree' }> }) {
  const optionListId = `${facet.id}-options`;
  const collapsibleOptions = useCollapsibleFacetOptions(
    facet.options.length,
    facet.label || getFilterLabelFallback(facet.id),
  );
  const visibleOptions = useMemo(
    () => facet.options.slice(0, collapsibleOptions.visibleCount),
    [collapsibleOptions.visibleCount, facet.options],
  );
  const treeNodes = useMemo(() => buildTreeNodes(visibleOptions), [visibleOptions]);

  return (
    <div className="flex flex-col gap-4">
      <div id={optionListId}>
        <TreeFacetBranch
          facetId={facet.id}
          activeFilters={activeFilters}
          applyFacet={applyFacet}
          resetFacet={resetFacet}
          nodes={treeNodes}
        />
      </div>
      {collapsibleOptions.canToggle ? (
        <FacetOptionToggle
          facetId={facet.id}
          listId={optionListId}
          label={collapsibleOptions.collapseButtonLabel}
          isExpanded={collapsibleOptions.isExpanded}
          onToggle={collapsibleOptions.toggleExpanded}
        />
      ) : null}
    </div>
  );
}

function RatingStars({ filledCount }: { filledCount: number }) {
  return (
    <div className="flex items-center gap-1 text-icon-secondary" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <RatingStar key={index} filled={index < filledCount} className="h-6 w-6" />
      ))}
    </div>
  );
}

function RatingFacetRenderer({
  facet,
  activeFilters,
  applyFacet,
  resetFacet,
}: FacetToggleRendererProps & { facet: Extract<BatteryIncludedFacet, { kind: 'rating' }> }) {
  const optionListId = `${facet.id}-options`;
  const collapsibleOptions = useCollapsibleFacetOptions(
    facet.options.length,
    facet.label || getFilterLabelFallback(facet.id),
  );
  const visibleOptions = facet.options.slice(0, collapsibleOptions.visibleCount);

  return (
    <div className="flex flex-col gap-4">
      <ul id={optionListId} className="flex flex-col gap-3 py-1" role="list">
        {visibleOptions.map((option) => {
          const checked = getActiveFacetValues(activeFilters[facet.id]).includes(option.id);
          const filledCount = Number(option.id);

          return (
            <li key={option.id}>
              <PlpFacetCheckboxRow
                facetId={facet.id}
                option={option}
                checked={checked}
                onToggle={() => {
                  const nextValue = toggleFacetValue(activeFilters[facet.id], option.id);

                  if (nextValue === undefined) {
                    resetFacet(facet.id);
                    return;
                  }

                  applyFacet(facet.id, nextValue);
                }}
                inlineLeadingContent
                leadingContent={Number.isInteger(filledCount) ? <RatingStars filledCount={filledCount} /> : undefined}
              />
            </li>
          );
        })}
      </ul>
      {collapsibleOptions.canToggle ? (
        <FacetOptionToggle
          facetId={facet.id}
          listId={optionListId}
          label={collapsibleOptions.collapseButtonLabel}
          isExpanded={collapsibleOptions.isExpanded}
          onToggle={collapsibleOptions.toggleExpanded}
        />
      ) : null}
    </div>
  );
}

function RangeFacetRenderer({
  facet,
  activeFilters,
  applyRangeFacet,
  resetFacet,
}: {
  facet: Extract<BatteryIncludedFacet, { kind: 'range' }>;
  activeFilters: Record<string, SearchFilterValue>;
  applyRangeFacet: (facetId: string, min: string, max: string) => void;
  resetFacet: (facetId: string) => void;
}) {
  const activeRange = getRangeFacetValue(activeFilters[facet.id]);
  const rawMax = Number(facet.max);
  const [rememberedMaxById, setRememberedMaxById] = React.useState<Record<string, number>>(() =>
    Number.isFinite(rawMax) ? { [facet.id]: rawMax } : {},
  );

  React.useEffect(() => {
    if (!Number.isFinite(rawMax)) {
      return;
    }
    setRememberedMaxById((prev) => {
      const existing = prev[facet.id];
      const next = existing === undefined ? rawMax : Math.max(existing, rawMax);
      if (next === existing) {
        return prev;
      }
      return { ...prev, [facet.id]: next };
    });
  }, [facet.id, rawMax]);

  const storedMax = rememberedMaxById[facet.id];
  const effectiveMax = Number.isFinite(rawMax)
    ? storedMax === undefined
      ? rawMax
      : Math.max(storedMax, rawMax)
    : (storedMax ?? rawMax);

  return (
    <RangeFacetDraftForm
      key={`${facet.id}:${activeRange?.from ?? ''}:${activeRange?.till ?? ''}:${effectiveMax}`}
      facet={facet}
      activeRange={activeRange}
      boundsMax={effectiveMax}
      applyRangeFacet={applyRangeFacet}
      resetFacet={resetFacet}
    />
  );
}

function RangeFacetDraftForm({
  facet,
  activeRange,
  boundsMax,
  applyRangeFacet,
  resetFacet,
}: {
  facet: Extract<BatteryIncludedFacet, { kind: 'range' }>;
  activeRange: { from?: string; till?: string } | undefined;
  boundsMax: number;
  applyRangeFacet: (facetId: string, min: string, max: string) => void;
  resetFacet: (facetId: string) => void;
}) {
  const t = useTranslations('product');
  const rangeLabel = facet.label || getFilterLabelFallback(facet.id);
  const minPlaceholder = 'min';
  const maxPlaceholder = 'max';
  const minValue = 0;
  const maxValue = Number.isFinite(boundsMax) ? Math.ceil(boundsMax / 100) * 100 : boundsMax;
  const [draftFrom, setDraftFrom] = useState(activeRange?.from ?? String(minValue));
  const [draftTill, setDraftTill] = useState(activeRange?.till ?? String(maxValue));
  const lastCommittedRangeRef = React.useRef<string | null>(null);

  const normalizeRangeInput = (value: string): string => {
    const trimmedValue = value.trim();

    if (trimmedValue === '') {
      return '';
    }

    const numericValue = Number(trimmedValue);

    if (!Number.isFinite(numericValue)) {
      return '';
    }

    return String(numericValue);
  };

  const commitRange = (nextFromInput: string, nextTillInput: string): void => {
    let nextFrom = normalizeRangeInput(nextFromInput);
    let nextTill = normalizeRangeInput(nextTillInput);

    const nextFromNumber = nextFrom === '' ? undefined : Number(nextFrom);
    const nextTillNumber = nextTill === '' ? undefined : Number(nextTill);

    if (nextFromNumber !== undefined && Number.isFinite(minValue) && Number.isFinite(maxValue)) {
      nextFrom = String(Math.min(Math.max(nextFromNumber, minValue), maxValue));
    }

    if (nextTillNumber !== undefined && Number.isFinite(minValue) && Number.isFinite(maxValue)) {
      nextTill = String(Math.min(Math.max(nextTillNumber, minValue), maxValue));
    }

    if (nextFrom !== '' && nextTill !== '' && Number(nextFrom) > Number(nextTill)) {
      [nextFrom, nextTill] = [nextTill, nextFrom];
    }

    setDraftFrom(nextFrom);
    setDraftTill(nextTill);

    if (nextFrom === '' && nextTill === '') {
      resetFacet(facet.id);
      return;
    }

    if (Number(nextFrom) <= minValue && Number(nextTill) >= maxValue) {
      resetFacet(facet.id);
      return;
    }

    const nextSignature = `${nextFrom}__${nextTill}`;
    if (lastCommittedRangeRef.current === nextSignature) {
      return;
    }

    lastCommittedRangeRef.current = nextSignature;

    applyRangeFacet(facet.id, nextFrom, nextTill);
  };

  React.useEffect(() => {
    lastCommittedRangeRef.current = `${activeRange?.from ?? ''}__${activeRange?.till ?? ''}`;
  }, [activeRange?.from, activeRange?.till]);

  const sliderValue = useMemo(() => {
    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
      return undefined;
    }

    const fromValue = draftFrom === '' ? minValue : Number(draftFrom);
    const tillValue = draftTill === '' ? maxValue : Number(draftTill);

    if (!Number.isFinite(fromValue) || !Number.isFinite(tillValue)) {
      return [minValue, maxValue];
    }

    return fromValue <= tillValue ? [fromValue, tillValue] : [tillValue, fromValue];
  }, [draftFrom, draftTill, maxValue, minValue]);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        commitRange(draftFrom, draftTill);
      }}
      onKeyDownCapture={(event) => {
        if (event.key !== 'Enter') {
          return;
        }

        event.preventDefault();
        commitRange(draftFrom, draftTill);
      }}
      onBlurCapture={(event) => {
        const nextFocusedElement = event.relatedTarget;

        if (nextFocusedElement instanceof Node && event.currentTarget.contains(nextFocusedElement)) {
          return;
        }

        commitRange(draftFrom, draftTill);
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${facet.id}-from`} className="sr-only">
            {t('filters.from', { defaultValue: 'From' })}
          </Label>
          <Input
            id={`${facet.id}-from`}
            name="from"
            type="number"
            inputMode="numeric"
            min={minValue}
            max={maxValue}
            value={draftFrom}
            placeholder={minPlaceholder}
            onChange={(event) => {
              setDraftFrom(event.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${facet.id}-till`} className="sr-only">
            {t('filters.till', { defaultValue: 'Till' })}
          </Label>
          <Input
            id={`${facet.id}-till`}
            name="till"
            type="number"
            inputMode="numeric"
            min={minValue}
            max={maxValue}
            value={draftTill}
            placeholder={maxPlaceholder}
            onChange={(event) => {
              setDraftTill(event.target.value);
            }}
          />
        </div>
      </div>
      {sliderValue ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-normal text-text-body">{rangeLabel}</p>
          <Slider
            value={sliderValue}
            min={minValue}
            max={maxValue}
            step={1}
            onValueChange={(values: number[]) => {
              setDraftFrom(String(values[0]));
              setDraftTill(String(values[1]));
            }}
            onValueCommit={(values: number[]) => {
              commitRange(String(values[0]), String(values[1]));
            }}
            data-testid={`plp-range-slider-${facet.id}`}
          />
        </div>
      ) : null}
    </form>
  );
}

function PlpFacetActiveFilters({
  activeFilters,
  resetFacet,
  resetAllFacets,
  categoryFilterLabelsById,
  batteryIncludedFacets,
}: {
  activeFilters: Record<string, SearchFilterValue>;
  resetFacet: (facetId: string) => void;
  resetAllFacets?: () => void;
  categoryFilterLabelsById?: Record<string, string>;
  batteryIncludedFacets?: BatteryIncludedFacet[];
}) {
  const t = useTranslations('product');

  if (!resetAllFacets || Object.keys(activeFilters).length === 0) {
    return null;
  }

  return (
    <section
      className="flex flex-col gap-4 border-b border-border-primary pb-6"
      aria-label={t('filters.activeFiltersTitle', { defaultValue: 'Active filters' })}
      data-testid="plp-facet-panel-active-filters"
    >
      <div className="flex flex-wrap gap-2">
        <SearchActiveFilters
          activeFilters={activeFilters}
          resetFacet={resetFacet}
          resetAllFacets={resetAllFacets}
          categoryFilterLabelsById={categoryFilterLabelsById}
          batteryIncludedFacets={batteryIncludedFacets}
        />
      </div>
    </section>
  );
}

function PlpFacetSection({
  facet,
  activeFilters,
  applyFacet,
  applyRangeFacet,
  resetFacet,
}: {
  facet: BatteryIncludedFacet;
  activeFilters: Record<string, SearchFilterValue>;
  applyFacet: (facetId: string, value: string | string[]) => void;
  applyRangeFacet: (facetId: string, min: string, max: string) => void;
  resetFacet: (facetId: string) => void;
}) {
  const label = facet.label || getFilterLabelFallback(facet.id);
  const selectedChoiceCount = getSelectedChoiceCount(facet, activeFilters);

  return (
    <AccordionItem value={facet.id} className="border-border-primary">
      <AccordionTrigger className="min-h-[50px] items-center py-0 text-base font-bold text-text-headings hover:no-underline">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate" title={label}>
            {label}
          </span>
          {selectedChoiceCount > 0 ? (
            <span className="whitespace-nowrap text-sm font-normal text-text-secondary">
              {' '}
              ({selectedChoiceCount} selected)
            </span>
          ) : null}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-5">
        {facet.kind === 'select' ? (
          <SelectFacetRenderer
            facet={facet}
            facetId={facet.id}
            activeFilters={activeFilters}
            applyFacet={applyFacet}
            resetFacet={resetFacet}
          />
        ) : null}
        {facet.kind === 'tree' ? (
          <TreeFacetRenderer
            facet={facet}
            facetId={facet.id}
            activeFilters={activeFilters}
            applyFacet={applyFacet}
            resetFacet={resetFacet}
          />
        ) : null}
        {facet.kind === 'rating' ? (
          <RatingFacetRenderer
            facet={facet}
            facetId={facet.id}
            activeFilters={activeFilters}
            applyFacet={applyFacet}
            resetFacet={resetFacet}
          />
        ) : null}
        {facet.kind === 'range' ? (
          <RangeFacetRenderer
            facet={facet}
            activeFilters={activeFilters}
            applyRangeFacet={applyRangeFacet}
            resetFacet={resetFacet}
          />
        ) : null}
      </AccordionContent>
    </AccordionItem>
  );
}

export function PlpFacetPanel({
  facets,
  activeFilters,
  applyFacet,
  applyRangeFacet,
  resetFacet,
  resetAllFacets,
  categoryFilterLabelsById,
  className,
  variant = 'card',
}: PlpFacetPanelProps) {
  const t = useTranslations('product');

  if (!facets || facets.length === 0) {
    return null;
  }

  const sectionFacets = facets.filter((f) => f.id !== BATTERY_INCLUDED_BREADCRUMB_FILTER);

  if (sectionFacets.length === 0 && Object.keys(activeFilters).length === 0) {
    return null;
  }

  const panelLabel = t('filters.filterButton', { defaultValue: 'Filters' });
  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  if (variant === 'list') {
    return (
      <div className={cn('flex flex-col gap-6 w-full', className)}>
        {hasActiveFilters ? (
          <SearchActiveFiltersWithReset
            activeFilters={activeFilters}
            resetFacet={resetFacet}
            resetAllFacets={resetAllFacets ?? (() => {})}
          />
        ) : null}

        {sectionFacets.length > 0 && (
          <Accordion
            type="multiple"
            defaultValue={sectionFacets.map((f) => `facet-${f.id}`)}
            className="flex w-full flex-col gap-4"
          >
            {sectionFacets.map((facet) => (
              <PlpFacetSection
                key={facet.id}
                facet={facet}
                activeFilters={activeFilters}
                applyFacet={applyFacet}
                applyRangeFacet={applyRangeFacet}
                resetFacet={resetFacet}
              />
            ))}
          </Accordion>
        )}
      </div>
    );
  }

  return (
    <section
      className={cn(
        'flex flex-col gap-6 rounded-[8px] border border-border-primary bg-surface-page p-6 shadow-sm md:gap-6',
        !hasActiveFilters && 'md:gap-3',
        className,
      )}
      aria-label={panelLabel}
      data-testid="plp-facet-panel"
    >
      <div className={cn('hidden items-center justify-between md:flex', hasActiveFilters ? 'md:mb-6' : 'md:mb-2')}>
        <h5 className="text-3xl font-bold text-text-headings">{panelLabel}</h5>
        <div className="flex items-center gap-4">
          {hasActiveFilters && (
            <Button
              type="button"
              variant="link"
              className="h-auto min-h-0 justify-start gap-2 p-0 text-sm font-normal normal-case tracking-normal text-text-action hover:underline focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
              onClick={resetAllFacets}
              aria-label={t('filters.clearAllFilters', { defaultValue: 'Clear filters' })}
            >
              <span className="truncate" title={t('filters.clearAllFilters', { defaultValue: 'Clear filters' })}>
                {t('filters.clearAllFilters', { defaultValue: 'Clear filters' })}
              </span>
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
            </Button>
          )}
          {/* Remove close button because it's now living in mobile-category-drawer.tsx */}
        </div>
      </div>
      <PlpFacetActiveFilters
        activeFilters={activeFilters}
        resetFacet={resetFacet}
        resetAllFacets={resetAllFacets}
        categoryFilterLabelsById={categoryFilterLabelsById}
        batteryIncludedFacets={facets}
      />
      {sectionFacets.length > 0 ? (
        <Accordion
          type="multiple"
          defaultValue={sectionFacets.map((facet) => facet.id)}
          className="flex flex-col gap-0"
        >
          {sectionFacets.map((facet) => (
            <PlpFacetSection
              key={facet.id}
              facet={facet}
              activeFilters={activeFilters}
              applyFacet={applyFacet}
              applyRangeFacet={applyRangeFacet}
              resetFacet={resetFacet}
            />
          ))}
        </Accordion>
      ) : null}
    </section>
  );
}
