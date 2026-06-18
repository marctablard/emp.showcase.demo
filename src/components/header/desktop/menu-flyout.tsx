'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { HeaderPromo } from '@/components/header/common/header-promo';
import { useNavigationProductSubmenu } from '@/components/header/navigation-product-submenu-context';
import { ALL_PRODUCTS_NAVIGATION_ITEM_ID, type MenuItem, type SubMenuItem } from '@/data/navigation-menu';
import { Link } from '@/i18n/navigation';
import { getNavigationRootCategoriesPageSize } from '@/lib/navigation/navigation-root-categories-page-size';
import { takeRootCategoryPage } from '@/lib/navigation/take-root-category-page';
import { cn } from '@/lib/utils';

/** Flyout: three equal category columns (50% total) + promo (50%) on large screens. */
const FLYOUT_CATEGORY_COLUMNS = 3;
/** Max parent selections: column 0 needs none; columns 1–2 need path[0], path[1]. */
const MAX_HOVER_PATH_LENGTH = FLYOUT_CATEGORY_COLUMNS - 1;
const FLYOUT_TOP_HEADER_LINK_CLASS_NAME =
  'text-md font-bold text-text-headings rounded-sm no-underline hover:bg-surface-action-hover-2';
const FLYOUT_LOWER_CTA_LINK_CLASS_NAME =
  'text-md font-bold text-text-action rounded-sm underline hover:bg-surface-action-hover-2';

interface DesktopMenuFlyoutProps {
  menuItem: MenuItem;
  onMouseLeave?: () => void;
}

function subMenuItemKey(item: SubMenuItem, index: number): string {
  return item.id ?? `${item.href}::${item.label}::${index}`;
}

export function DesktopMenuFlyout({ menuItem, onMouseLeave }: DesktopMenuFlyoutProps) {
  const t = useTranslations('layout.header');
  const tFooterLinks = useTranslations('layout.footerLinks');
  const { showSeeAllBrowse } = useNavigationProductSubmenu();
  const [hoveredPath, setHoveredPath] = useState<SubMenuItem[]>([]);
  const categoryPreviewCount = getNavigationRootCategoriesPageSize();
  const browseAllLabel = t('allProducts');
  const lowerCtaBrowseAllLabel = tFooterLinks('showAllCategories');

  const submenuItems = menuItem.submenuItems ?? [];

  const columnItems = (colIndex: number): SubMenuItem[] => {
    if (colIndex === 0) {
      return submenuItems;
    }
    const parent = hoveredPath[colIndex - 1];
    return parent?.submenuItems ?? [];
  };

  const handleSubItemClick = (colIndex: number, item: SubMenuItem) => {
    const hasChildren = item.hasSubmenu && (item.submenuItems?.length ?? 0) > 0;
    if (!hasChildren || colIndex >= MAX_HOVER_PATH_LENGTH) {
      return;
    }
    setHoveredPath((prev) =>
      prev[colIndex] === item
        ? prev.slice(0, colIndex)
        : [...prev.slice(0, colIndex), item].slice(0, MAX_HOVER_PATH_LENGTH),
    );
  };

  const setPathOnEnter = (colIndex: number, item: SubMenuItem, hasChildren: boolean) => {
    if (!hasChildren) {
      setHoveredPath((prev) => prev.slice(0, colIndex));
      return;
    }
    if (colIndex >= MAX_HOVER_PATH_LENGTH) {
      return;
    }
    setHoveredPath((prev) => [...prev.slice(0, colIndex), item].slice(0, MAX_HOVER_PATH_LENGTH));
  };

  return (
    <div
      className={cn(
        'backdrop-active pt-6 -mb-2 pb-6 -mx-6 px-6',
        'flex flex-col gap-4',
        'md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,3fr)] md:gap-x-0 md:gap-y-4',
      )}
      onMouseLeave={onMouseLeave}
    >
      {Array.from({ length: FLYOUT_CATEGORY_COLUMNS }, (_, colIndex) => {
        const rawItems = columnItems(colIndex);
        const isProductRootColumn = colIndex === 0 && menuItem.id === ALL_PRODUCTS_NAVIGATION_ITEM_ID;
        const showRootBrowseHeader = isProductRootColumn && !showSeeAllBrowse;

        let displayItems: SubMenuItem[];
        let showBrowseAllInColumn = false;

        if (isProductRootColumn) {
          displayItems = rawItems;
          showBrowseAllInColumn = showSeeAllBrowse;
        } else if (colIndex === 0) {
          displayItems = rawItems;
        } else {
          const page = takeRootCategoryPage(rawItems, categoryPreviewCount);
          displayItems = page.visible;
        }

        const showColumnHeader = colIndex > 0;
        const parentForHeader = showColumnHeader ? hoveredPath[colIndex - 1] : undefined;
        const columnHeaderLabel = parentForHeader ? t('allFromCategory', { name: parentForHeader.label }) : undefined;

        return (
          <div
            key={colIndex}
            className={cn(
              'min-h-[12rem] min-w-0 border-border-subtle py-1 md:w-full',
              colIndex > 0 && 'md:border-s md:ps-2',
            )}
          >
            {showRootBrowseHeader ? (
              <Link
                href="/browse"
                className={cn('block px-4 pb-2', FLYOUT_TOP_HEADER_LINK_CLASS_NAME)}
                onMouseEnter={() => setHoveredPath([])}
              >
                {browseAllLabel}
              </Link>
            ) : null}
            {showColumnHeader && parentForHeader ? (
              <Link href={parentForHeader.href} className={cn('block px-4 pb-2', FLYOUT_TOP_HEADER_LINK_CLASS_NAME)}>
                {columnHeaderLabel}
              </Link>
            ) : null}
            <ul>
              {displayItems.map((item, index) => {
                const hasChildren = item.hasSubmenu && (item.submenuItems?.length ?? 0) > 0;
                const isDeepestColumn = colIndex === FLYOUT_CATEGORY_COLUMNS - 1;
                const treatAsLeaf = !hasChildren || (isDeepestColumn && hasChildren);
                const isActive = hoveredPath[colIndex] === item;
                const rowClass = cn(
                  'w-full flex items-center px-4 py-2 text-md rounded-sm hover:bg-surface-action-hover-2',
                  colIndex === 0 ? 'font-bold' : '',
                  isActive && !isDeepestColumn && 'bg-surface-action-hover-2',
                );

                if (item.href && treatAsLeaf) {
                  return (
                    <li key={subMenuItemKey(item, index)}>
                      <Link
                        href={item.href}
                        className={rowClass}
                        onMouseEnter={() => setPathOnEnter(colIndex, item, false)}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                }

                if (item.href && hasChildren) {
                  return (
                    <li key={subMenuItemKey(item, index)}>
                      <Link
                        href={item.href}
                        className={cn(rowClass, 'justify-between')}
                        onMouseEnter={() => setPathOnEnter(colIndex, item, true)}
                      >
                        {item.label}
                        <ChevronRight className="w-5 h-5 ms-1 shrink-0" aria-hidden />
                      </Link>
                    </li>
                  );
                }

                return (
                  <li key={subMenuItemKey(item, index)}>
                    <button
                      type="button"
                      className={cn(rowClass, 'cursor-pointer text-start', !isDeepestColumn && 'justify-between')}
                      onMouseEnter={() => setPathOnEnter(colIndex, item, true)}
                      onClick={() => handleSubItemClick(colIndex, item)}
                    >
                      {item.label}
                      {!isDeepestColumn ? <ChevronRight className="w-5 h-5 ms-1 shrink-0" aria-hidden /> : null}
                    </button>
                  </li>
                );
              })}
              {isProductRootColumn && showBrowseAllInColumn ? (
                <li>
                  <Link
                    href="/browse"
                    className={cn('mt-1 flex items-center px-4 py-2', FLYOUT_LOWER_CTA_LINK_CLASS_NAME)}
                    onMouseEnter={() => setHoveredPath([])}
                  >
                    {lowerCtaBrowseAllLabel}
                  </Link>
                </li>
              ) : null}
            </ul>
          </div>
        );
      })}
      <HeaderPromo className="min-w-0 max-md:w-full" />
    </div>
  );
}
