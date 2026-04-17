'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ChevronDown, MapPin } from 'lucide-react';
import { HeaderPromo } from '@/components/header/common/header-promo';
import { LocationSettingsDialog } from '@/components/header/mobile/location-settings-dialog';
import { useNavigationProductSubmenu } from '@/components/header/navigation-product-submenu-context';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { SubMenuItem } from '@/data/navigation-menu';
import { ALL_PRODUCTS_NAVIGATION_ITEM_ID, navigationMenuItems, serviceMenuItems } from '@/data/navigation-menu';
import { Link } from '@/i18n/navigation';
import { mergeNavigationProductSubmenu } from '@/lib/navigation/merge-navigation-product-submenu';
import { getNavigationRootCategoriesPageSize } from '@/lib/navigation/navigation-root-categories-page-size';
import { takeRootCategoryPage } from '@/lib/navigation/take-root-category-page';
import { cn } from '@/lib/utils';

interface MobileMenuNavigationProps {
  onClose?: () => void;
}

function subMenuItemKey(item: SubMenuItem, index: number): string {
  return item.id ?? `${item.href}::${item.label}::${index}`;
}

function expandKey(item: SubMenuItem, index: number): string {
  return item.id ?? subMenuItemKey(item, index);
}

interface NestedSubmenuProps {
  items: SubMenuItem[];
  depth: number;
  expandedItems: Set<string>;
  toggleExpanded: (key: string) => void;
  onNavigate?: () => void;
}

function NestedSubmenuItems({ items, depth, expandedItems, toggleExpanded, onNavigate }: NestedSubmenuProps) {
  const rowPad = depth === 0 ? 'px-5' : 'px-2';

  return (
    <ul className={cn(depth > 0 && 'ms-3 border-s border-border-subtle ps-3')}>
      {items.map((item, index) => {
        const key = expandKey(item, index);
        const hasChildren = item.hasSubmenu && (item.submenuItems?.length ?? 0) > 0;

        if (item.href && !hasChildren) {
          return (
            <li key={subMenuItemKey(item, index)}>
              <Link
                href={item.href}
                onClick={() => onNavigate?.()}
                className={cn(
                  'flex items-center justify-between py-3',
                  depth === 0 ? 'text-md font-bold' : 'text-base',
                  rowPad,
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        }

        if (hasChildren && item.submenuItems) {
          return (
            <li key={subMenuItemKey(item, index)}>
              <Collapsible open={expandedItems.has(key)} onOpenChange={() => toggleExpanded(key)}>
                <CollapsibleTrigger
                  className={cn(
                    'w-full flex items-center justify-between py-3 text-base font-bold cursor-pointer text-start',
                    rowPad,
                  )}
                >
                  {item.label}
                  <ChevronDown
                    className={cn('w-5 h-5 shrink-0 transition-transform', expandedItems.has(key) && 'rotate-180')}
                    aria-hidden
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <NestedSubmenuItems
                    items={item.submenuItems}
                    depth={depth + 1}
                    expandedItems={expandedItems}
                    toggleExpanded={toggleExpanded}
                    onNavigate={onNavigate}
                  />
                </CollapsibleContent>
              </Collapsible>
            </li>
          );
        }

        return (
          <li key={subMenuItemKey(item, index)}>
            <span className={cn('flex items-center py-3 text-base', rowPad)}>{item.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function MobileMenuNavigation({ onClose }: MobileMenuNavigationProps) {
  const t = useTranslations('layout.header');
  const { submenuItems: productCategorySubmenu, showSeeAllBrowse } = useNavigationProductSubmenu();

  const menuItems = navigationMenuItems.map((item) => {
    const merged = mergeNavigationProductSubmenu(item, productCategorySubmenu);
    return {
      ...merged,
      label: t(item.labelKey as any),
    };
  });

  const serviceItems = serviceMenuItems.map((item) => ({
    ...item,
    label: t(item.labelKey as any),
  }));

  const [currentView, setCurrentView] = useState<'main' | string>('main');
  const [secondLevelLabel, setSecondLevelLabel] = useState<string>('');
  const [showLocationSettings, setShowLocationSettings] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((itemKey: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
  }, []);

  const getItemsForView = (view: string): SubMenuItem[] => {
    if (view === 'main') {
      return [];
    }
    type NavEntry = { id?: string; label?: string; submenuItems?: SubMenuItem[] };
    const findSubmenu = (nodes: NavEntry[], targetId: string): SubMenuItem[] | null => {
      for (const item of nodes) {
        if (item.id === targetId || item.label === targetId) {
          return item.submenuItems ?? [];
        }
        if (item.submenuItems?.length) {
          const found = findSubmenu(item.submenuItems as NavEntry[], targetId);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };
    return findSubmenu(menuItems as NavEntry[], view) ?? [];
  };

  const handleItemClick = (item: (typeof menuItems)[0]) => {
    if (item.hasSubmenu && currentView === 'main') {
      setSecondLevelLabel(item.label);
      setCurrentView(item.id || item.label);
    } else if (item.href) {
      onClose?.();
    }
  };

  const handleBack = () => {
    if (currentView !== 'main') {
      setCurrentView('main');
      setExpandedItems(new Set());
    }
  };

  const mainItems = menuItems;
  const secondLevelItems = currentView !== 'main' ? getItemsForView(currentView) : [];
  const categoryPreviewCount = getNavigationRootCategoriesPageSize();
  const secondLevelPage =
    currentView === ALL_PRODUCTS_NAVIGATION_ITEM_ID
      ? takeRootCategoryPage(secondLevelItems, categoryPreviewCount)
      : null;
  const secondLevelVisibleItems = secondLevelPage?.visible ?? secondLevelItems;
  const secondLevelTruncated = secondLevelPage?.truncated ?? false;
  const showMobileProductsSeeAll =
    currentView === ALL_PRODUCTS_NAVIGATION_ITEM_ID && (showSeeAllBrowse || secondLevelTruncated);

  const renderMainMenuItems = () => (
    <ul>
      {mainItems.map((item, index) => (
        <li key={item.id || index}>
          {item.href && !item.hasSubmenu ? (
            <>
              <Link
                href={item.href}
                onClick={() => onClose?.()}
                className="flex items-center justify-between px-5 py-4 text-lg"
              >
                {item.label}
              </Link>
              <hr className="mx-5 border-border-subtle" />
            </>
          ) : item.hasSubmenu ? (
            <>
              <button
                type="button"
                onClick={() => handleItemClick(item)}
                className="w-full flex items-center justify-between px-5 py-4 text-lg cursor-pointer"
              >
                {item.label}
                <ChevronDown className="w-5 h-5 ms-1 shrink-0" aria-hidden />
              </button>
              <hr className="mx-5 border-border-subtle" />
            </>
          ) : (
            <Link
              href={item.href || '#'}
              onClick={() => onClose?.()}
              className="flex items-center justify-between px-5 py-4 text-lg"
            >
              {item.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex overflow-hidden">
      <nav
        className={`w-full flex transition-transform duration-300 ease-in-out ${currentView !== 'main' ? '-translate-x-full' : 'translate-x-0'}`}
      >
        <div className="w-full flex-shrink-0 bg-surface-page overflow-y-auto">
          {renderMainMenuItems()}

          <ul>
            <li>
              <div className="px-5 pt-8 font-semibold text-base text-text-placeholders">{t('serviceAndContact')}</div>
            </li>
            {serviceItems.map((item) => (
              <li key={item.id}>
                {item.href && (
                  <Link
                    href={item.href}
                    onClick={() => onClose?.()}
                    className="flex items-center justify-between px-5 py-4 text-md"
                  >
                    {item.label}
                  </Link>
                )}
                <hr className="mx-5 border-border-subtle" />
              </li>
            ))}
          </ul>

          <ul>
            <li>
              <div className="px-5 pt-8 font-semibold text-base text-text-placeholders">{t('settings')}</div>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setShowLocationSettings(true)}
                className="w-full flex items-center justify-between px-5 py-4 text-md cursor-pointer"
              >
                {t('locationSettings')}
                <MapPin className="w-5 h-5 shrink-0" aria-hidden />
              </button>
            </li>
          </ul>

          <HeaderPromo />
        </div>

        <div className="w-full flex-shrink-0 bg-surface-page overflow-y-auto">
          <div className="flex items-center gap-3 px-4 py-4">
            <button type="button" onClick={handleBack} className="flex items-center gap-2">
              <ArrowLeft className="w-5 h-5 text-text-action shrink-0" aria-hidden />
              <span className="text-lg font-medium">{secondLevelLabel || 'Back'}</span>
            </button>
          </div>
          <hr className="mx-5 border-border-subtle" />

          <NestedSubmenuItems
            items={secondLevelVisibleItems}
            depth={0}
            expandedItems={expandedItems}
            toggleExpanded={toggleExpanded}
            onNavigate={onClose}
          />
          {showMobileProductsSeeAll ? (
            <ul>
              <li>
                <Link
                  href="/browse"
                  onClick={() => onClose?.()}
                  className="flex items-center justify-between px-5 py-4 text-md font-bold text-text-action"
                >
                  {t('seeAllCategories')}
                </Link>
              </li>
            </ul>
          ) : null}
        </div>
      </nav>

      <LocationSettingsDialog open={showLocationSettings} onOpenChange={setShowLocationSettings} />
    </div>
  );
}
