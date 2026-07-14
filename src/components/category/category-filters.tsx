'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export interface CategoryFilterNode {
  id: string;
  label: string;
  children: CategoryFilterNode[];
}

interface CategoryFiltersProps {
  nodes: CategoryFilterNode[];
  selectedIds: string[];
  baseHref: string;
  /** Category from the page URL — already implied by context, so omit from chips. */
  excludeId?: string;
  className?: string;
}

function flattenFilterNodes(nodes: CategoryFilterNode[], excludeId?: string): Omit<CategoryFilterNode, 'children'>[] {
  const flat: Omit<CategoryFilterNode, 'children'>[] = [];
  for (const node of nodes) {
    if (node.id !== excludeId) {
      flat.push({ id: node.id, label: node.label });
    }
    flat.push(...flattenFilterNodes(node.children, excludeId));
  }
  return flat;
}

function buildFilterHref(baseHref: string, selectedIds: string[], toggleId: string): string {
  const nextIds = selectedIds.includes(toggleId)
    ? selectedIds.filter((id) => id !== toggleId)
    : [...selectedIds, toggleId];

  if (nextIds.length === 0) {
    return baseHref;
  }

  const params = new URLSearchParams();
  for (const id of nextIds) {
    params.append('c', id);
  }
  return `${baseHref}?${params.toString()}`;
}

export function CategoryFilters({ nodes, selectedIds, baseHref, excludeId, className }: CategoryFiltersProps) {
  const t = useTranslations('search.searchResults');
  const options = flattenFilterNodes(nodes, excludeId);

  if (options.length === 0) {
    return null;
  }

  return (
    <div className={cn('mb-8', className)}>
      {selectedIds.length > 0 && (
        <div className="mb-3 flex justify-end">
          <Link href={baseHref} className="text-sm text-text-action hover:underline">
            {t('resetFilter')}
          </Link>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {options.map((option) => {
          const isSelected = selectedIds.includes(option.id);

          return (
            <Link
              key={option.id}
              href={buildFilterHref(baseHref, selectedIds, option.id)}
              className={cn(
                'inline-flex items-center rounded-full px-3 py-1 text-sm transition-colors',
                isSelected
                  ? 'bg-surface-action text-text-on-action'
                  : 'text-text-body ring-1 ring-inset ring-border-subtle hover:ring-border-action',
              )}
              aria-pressed={isSelected}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
