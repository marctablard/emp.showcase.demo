'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { HeaderPromo } from '@/components/header/common/header-promo';
import { useNavigationProductSubmenu } from '@/components/header/navigation-product-submenu-context';
import { ALL_PRODUCTS_NAVIGATION_ITEM_ID, navigationMenuItems, SubMenuItem } from '@/data/navigation-menu';
import { Link } from '@/i18n/navigation';
import { mergeNavigationProductSubmenu } from '@/lib/navigation/merge-navigation-product-submenu';
import { getNavigationRootCategoriesPageSize } from '@/lib/navigation/navigation-root-categories-page-size';
import { takeRootCategoryPage } from '@/lib/navigation/take-root-category-page';
import { cn } from '@/lib/utils';

interface TabletDrillLevel {
  /** Section title for “All from {name}” and browse link target label context */
  allFromSectionName: string;
  allFromHref: string;
  items: SubMenuItem[];
  topMenuId?: string;
  /** Parent category PLP when the child list is truncated (see all). */
  categorySeeAllHref?: string;
}

function subMenuItemKey(item: SubMenuItem, index: number): string {
  return item.id ?? `${item.href}::${item.label}::${index}`;
}

const mainNavRowClass =
  'flex min-h-11 min-w-0 flex-1 items-center py-3 text-start text-lg text-text-body';

export interface TabletMenuFlyoutProps {
  onRequestClose?: () => void;
}

export function TabletMenuFlyout({ onRequestClose }: TabletMenuFlyoutProps) {
  const t = useTranslations('layout.header');
  const { submenuItems: productCategorySubmenu, showSeeAllBrowse } = useNavigationProductSubmenu();

  const menuItems = navigationMenuItems.map((item) => {
    const merged = mergeNavigationProductSubmenu(item, productCategorySubmenu);
    return {
      ...merged,
      label: t(item.labelKey as any),
    };
  });

  const [drillStack, setDrillStack] = useState<TabletDrillLevel[]>([]);

  const isDrilldown = drillStack.length > 0;
  const currentLevel = isDrilldown ? drillStack[drillStack.length - 1] : null;

  const topLevelBrowseHref = useCallback((item: (typeof menuItems)[0]): string => {
    if (item.href) {
      return item.href;
    }
    if (item.id === ALL_PRODUCTS_NAVIGATION_ITEM_ID) {
      return '/browse';
    }
    return '/browse';
  }, []);

  const openTopLevel = useCallback(
    (item: (typeof menuItems)[0]) => {
      if (!item.hasSubmenu || !(item.submenuItems?.length ?? 0)) {
        return;
      }
      setDrillStack([
        {
          allFromSectionName: item.label,
          allFromHref: topLevelBrowseHref(item),
          items: item.submenuItems ?? [],
          topMenuId: item.id,
        },
      ]);
    },
    [topLevelBrowseHref],
  );

  const openNested = useCallback((item: SubMenuItem) => {
    if (!item.hasSubmenu || !(item.submenuItems?.length ?? 0)) {
      return;
    }
    setDrillStack((s) => [
      ...s,
      {
        allFromSectionName: item.label,
        allFromHref: item.href,
        items: item.submenuItems ?? [],
        topMenuId: s[0]?.topMenuId,
        categorySeeAllHref: item.href,
      },
    ]);
  }, []);

  const handleBack = useCallback(() => {
    setDrillStack((s) => s.slice(0, -1));
  }, []);

  const categoryPreviewCount = getNavigationRootCategoriesPageSize();
  const { visible: drillVisibleItems, truncated: drillTruncated } = takeRootCategoryPage(
    currentLevel?.items ?? [],
    categoryPreviewCount,
  );
  const tabletSeeAllHref =
    drillTruncated && currentLevel?.categorySeeAllHref ? currentLevel.categorySeeAllHref : '/browse';
  const showTabletSeeAll =
    (currentLevel?.topMenuId === ALL_PRODUCTS_NAVIGATION_ITEM_ID && showSeeAllBrowse) ||
    (drillTruncated && !!currentLevel?.categorySeeAllHref);

  const closeAfterNavigate = useCallback(() => {
    onRequestClose?.();
  }, [onRequestClose]);

  return (
    <div className="backdrop-active mt-6 mb-4">
      {!isDrilldown ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-2">
            <ul className="flex min-w-0 flex-1 flex-col">
              {menuItems.map((item) => {
                const hasSubmenu = item.hasSubmenu && (item.submenuItems?.length ?? 0) > 0;
                return (
                  <li key={item.id} className="border-b border-border-subtle last:border-b-0">
                    {item.href && !hasSubmenu ? (
                      <Link href={item.href} className={cn(mainNavRowClass, 'w-full')} onClick={closeAfterNavigate}>
                        {item.label}
                      </Link>
                    ) : hasSubmenu ? (
                      <div className="flex w-full items-stretch">
                        <Link
                          href={topLevelBrowseHref(item)}
                          className={cn(mainNavRowClass, 'pe-2')}
                          onClick={closeAfterNavigate}
                        >
                          <span className="truncate">{item.label}</span>
                        </Link>
                        <button
                          type="button"
                          className="flex shrink-0 items-center justify-center px-3 py-2 text-text-action"
                          aria-label={t('openSubcategoriesFor', { name: item.label })}
                          onClick={() => openTopLevel(item)}
                        >
                          <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div className="flex max-w-full shrink-0 gap-2 overflow-x-auto pb-1 md:pb-0">
              <HeaderPromo className="contents m-0" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-3 rounded-sm px-4 py-3 text-start text-sm font-bold uppercase tracking-wide text-text-action"
            >
              <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden />
              {t('back')}
            </button>
            {currentLevel ? (
              <Link
                href={currentLevel.allFromHref}
                className="flex items-center justify-between gap-2 py-2 text-md font-bold text-text-body"
                onClick={closeAfterNavigate}
              >
                <span className="min-w-0 truncate">
                  {t('allFromCategory', { name: currentLevel.allFromSectionName })}
                </span>
                <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
              </Link>
            ) : null}
            <hr className="border-border-subtle" />
          </div>
          <ul className="flex min-w-0 flex-col">
            {drillVisibleItems.map((item, index) => {
              const hasChildren = item.hasSubmenu && (item.submenuItems?.length ?? 0) > 0;
              if (item.href && !hasChildren) {
                return (
                  <li key={subMenuItemKey(item, index)} className="border-b border-border-subtle last:border-b-0">
                    <Link
                      href={item.href}
                      className="flex w-full items-center justify-between py-2 text-md text-text-body"
                      onClick={closeAfterNavigate}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              }
              if (hasChildren) {
                return (
                  <li key={subMenuItemKey(item, index)} className="border-b border-border-subtle last:border-b-0">
                    <div className="flex w-full items-stretch">
                      <Link
                        href={item.href}
                        className="flex min-h-11 min-w-0 flex-1 items-center py-2 pe-2 text-start text-md font-bold text-text-body"
                        onClick={closeAfterNavigate}
                      >
                        <span className="truncate">{item.label}</span>
                      </Link>
                      <button
                        type="button"
                        className="flex shrink-0 items-center justify-center px-3 py-2 text-text-action"
                        aria-label={t('openSubcategoriesFor', { name: item.label })}
                        onClick={() => openNested(item)}
                      >
                        <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
                      </button>
                    </div>
                  </li>
                );
              }
              return (
                <li key={subMenuItemKey(item, index)} className="border-b border-border-subtle last:border-b-0">
                  <span className="flex items-center py-2 text-md">{item.label}</span>
                </li>
              );
            })}
            {showTabletSeeAll ? (
              <li className="border-b border-border-subtle last:border-b-0">
                <Link
                  href={tabletSeeAllHref}
                  className="flex items-center justify-between py-2 text-md font-bold text-text-action"
                  onClick={closeAfterNavigate}
                >
                  {t('seeAllCategories')}
                </Link>
              </li>
            ) : null}
          </ul>
          <div className="flex max-w-full shrink-0 gap-2 overflow-x-auto pb-1">
            <HeaderPromo className="contents m-0" />
          </div>
        </div>
      )}
    </div>
  );
}
