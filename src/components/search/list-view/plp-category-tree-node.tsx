'use client';

import type { KeyboardEvent, Ref } from 'react';
import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link } from '@/i18n/navigation';
import { getCategoryChildren } from '@/lib/category/category-tree-utils';
import { buildBrowseHrefForCategoryId } from '@/lib/navigation/build-browse-category-href';
import { cn, l10n } from '@/lib/utils';
import type { Category } from '@/platform/services/model/category';

interface PlpCategoryTreeNodeProps {
  node: Category;
  level: number;
  locale: string;
  selectedCategoryId?: string;
  /**
   * Id chain of the ancestor path of the active category (inclusive of the active category).
   * Passed from the tree root so every node can decide whether it is on the active branch
   * without re-walking the forest.
   */
  selectedPathIds: ReadonlySet<string>;
  counts: Record<string, number>;
  /**
   * Optional ref forwarded to the selected node's label so the tree can scroll it into view
   * on deep-linked loads. Only the selected node receives a ref from the parent.
   */
  selectedLabelRef?: Ref<HTMLAnchorElement>;
}

/**
 * Recursive category tree row. Each row has an optional chevron `<button>` that only toggles
 * local open state (no URL change) and a site-aware `<Link>` label that navigates to the
 * category-scoped PLP (preserves "all category names clickable").
 *
 * Nodes whose id is on the ancestor path of the selected category auto-open; manual expansions
 * are preserved even when the selection moves elsewhere. Leaves render without a chevron.
 */
export function PlpCategoryTreeNode({
  node,
  level,
  locale,
  selectedCategoryId,
  selectedPathIds,
  counts,
  selectedLabelRef,
}: PlpCategoryTreeNodeProps) {
  const t = useTranslations('search.plpCategoryTree');
  const children = useMemo(() => getCategoryChildren(node), [node]);
  const hasChildren = children.length > 0;

  const isOnActiveBranch = selectedPathIds.has(node.id);
  const [open, setOpen] = useState(isOnActiveBranch);
  // Re-open when the active branch moves onto this node (e.g. user clicks a deep link).
  // Intentionally never force-close so manual expansions are preserved across selections.
  // Uses the "state derived from props" pattern (setState during render) rather than an effect
  // so the render flushes without an extra paint.
  const [prevOnActiveBranch, setPrevOnActiveBranch] = useState(isOnActiveBranch);
  if (prevOnActiveBranch !== isOnActiveBranch) {
    setPrevOnActiveBranch(isOnActiveBranch);
    if (isOnActiveBranch) {
      setOpen(true);
    }
  }

  const isSelected = selectedCategoryId === node.id;
  const count = counts[node.id];
  const href = buildBrowseHrefForCategoryId(node.id);
  const name = l10n(node.name, locale);

  const chevronButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!hasChildren) {
      return;
    }
    if (event.key === 'ArrowRight' && !open) {
      event.preventDefault();
      setOpen(true);
      chevronButtonRef.current?.focus();
    } else if (event.key === 'ArrowLeft' && open) {
      event.preventDefault();
      setOpen(false);
      chevronButtonRef.current?.focus();
    }
  };

  return (
    <li data-testid="plp-category-tree-node" data-open={open ? 'true' : 'false'}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div
          role="treeitem"
          aria-selected={isSelected || undefined}
          aria-expanded={hasChildren ? open : undefined}
          onKeyDown={handleKeyDown}
          className={cn(
            'flex w-full items-center gap-1 rounded-sm transition',
            'hover:bg-surface-action-subtle',
            isSelected && 'bg-surface-action-subtle',
          )}
          style={{ paddingLeft: `calc(${level} * 1rem)` }}
        >
          {hasChildren ? (
            <CollapsibleTrigger asChild>
              <button
                ref={chevronButtonRef}
                type="button"
                aria-label={open ? t('collapse', { name }) : t('expand', { name })}
                data-testid="plp-category-tree-chevron"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-icon-action outline-none transition hover:bg-surface-action-subtle focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', open ? 'rotate-0' : '-rotate-90')}
                  aria-hidden="true"
                />
              </button>
            </CollapsibleTrigger>
          ) : (
            // Placeholder reserves space so leaf labels line up with expandable siblings.
            <span className="h-7 w-7 shrink-0" aria-hidden="true" />
          )}
          <Link
            ref={isSelected ? selectedLabelRef : undefined}
            href={href}
            aria-current={isSelected ? 'page' : undefined}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-between gap-2 px-2 py-1.5 text-base outline-none transition',
              'hover:text-text-action focus-visible:ring-2 focus-visible:ring-border-focus',
              isSelected ? 'font-bold text-text-action' : 'text-text-body',
            )}
          >
            <span className="truncate">{name}</span>
            {typeof count === 'number' ? (
              <span className={cn('shrink-0 text-sm', isSelected ? 'text-text-action' : 'text-text-placeholders')}>
                {count}
              </span>
            ) : null}
          </Link>
        </div>
        {hasChildren ? (
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
            <ul className="flex flex-col" role="group">
              {children.map((child) => (
                <PlpCategoryTreeNode
                  key={child.id}
                  node={child}
                  level={level + 1}
                  locale={locale}
                  selectedCategoryId={selectedCategoryId}
                  selectedPathIds={selectedPathIds}
                  counts={counts}
                  selectedLabelRef={selectedLabelRef}
                />
              ))}
            </ul>
          </CollapsibleContent>
        ) : null}
      </Collapsible>
    </li>
  );
}

export default PlpCategoryTreeNode;
