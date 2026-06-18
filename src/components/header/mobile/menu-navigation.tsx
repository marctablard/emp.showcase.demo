'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ChevronRight, MapPin } from 'lucide-react';
import { HeaderPromo } from '@/components/header/common/header-promo';
import { LocationSettingsDialog } from '@/components/header/mobile/location-settings-dialog';
import { useNavigationProductSubmenu } from '@/components/header/navigation-product-submenu-context';
import type { SubMenuItem } from '@/data/navigation-menu';
import { ALL_PRODUCTS_NAVIGATION_ITEM_ID, navigationMenuItems, serviceMenuItems } from '@/data/navigation-menu';
import { Link } from '@/i18n/navigation';
import { mergeNavigationProductSubmenu } from '@/lib/navigation/merge-navigation-product-submenu';

interface MobileMenuNavigationProps {
  onClose?: () => void;
}

function subMenuItemKey(item: SubMenuItem, index: number): string {
  return item.id ?? `${item.href}::${item.label}::${index}`;
}

function expandKey(item: SubMenuItem, index: number): string {
  return item.id ?? subMenuItemKey(item, index);
}

interface MobileDrillLevel {
  label: string;
  href: string;
  items: SubMenuItem[];
  rootViewId: string;
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
  const mainItems = menuItems;

  const [drillStack, setDrillStack] = useState<MobileDrillLevel[]>([]);
  const [showLocationSettings, setShowLocationSettings] = useState(false);

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
          label: item.label,
          href: topLevelBrowseHref(item),
          items: item.submenuItems ?? [],
          rootViewId: item.id,
        },
      ]);
    },
    [topLevelBrowseHref],
  );

  const openNested = useCallback((item: SubMenuItem, index: number) => {
    if (!item.hasSubmenu || !(item.submenuItems?.length ?? 0)) {
      return;
    }

    setDrillStack((prev) => [
      ...prev,
      {
        label: item.label,
        href: item.href,
        items: item.submenuItems ?? [],
        rootViewId: prev[0]?.rootViewId ?? expandKey(item, index),
      },
    ]);
  }, []);

  const handleBack = () => {
    if (drillStack.length <= 1) {
      setDrillStack([]);
      return;
    }

    setDrillStack((prev) => prev.slice(0, -1));
  };

  const isSubmenuView = drillStack.length > 0;
  const currentLevel = isSubmenuView ? drillStack[drillStack.length - 1] : null;
  const currentItems = currentLevel?.items ?? [];
  const showMobileProductsSeeAll = currentLevel?.rootViewId === ALL_PRODUCTS_NAVIGATION_ITEM_ID && showSeeAllBrowse;

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
                onClick={() => openTopLevel(item)}
                className="w-full flex items-center justify-between px-5 py-4 text-lg cursor-pointer"
                aria-label={t('openSubcategoriesFor', { name: item.label })}
              >
                {item.label}
                <ChevronRight className="w-5 h-5 ms-1 shrink-0" aria-hidden />
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
        className={`w-full flex transition-transform duration-300 ease-in-out ${isSubmenuView ? '-translate-x-full' : 'translate-x-0'}`}
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
              <span className="text-lg font-medium">{t('back')}</span>
            </button>
          </div>
          <hr className="mx-5 border-border-subtle" />

          {currentLevel ? (
            <div className="px-5 py-4">
              <Link
                href={currentLevel.href}
                onClick={() => onClose?.()}
                className="flex items-center justify-between text-md font-bold text-text-headings"
              >
                <span className="truncate">{currentLevel.label}</span>
              </Link>
            </div>
          ) : null}

          <ul>
            {currentItems.map((item, index) => {
              const hasChildren = item.hasSubmenu && (item.submenuItems?.length ?? 0) > 0;

              if (item.href && !hasChildren) {
                return (
                  <li key={subMenuItemKey(item, index)}>
                    <Link
                      href={item.href}
                      onClick={() => onClose?.()}
                      className="flex items-center justify-between px-5 py-4 text-md text-text-body"
                    >
                      <span className="truncate">{item.label}</span>
                    </Link>
                    <hr className="mx-5 border-border-subtle" />
                  </li>
                );
              }

              if (hasChildren) {
                return (
                  <li key={subMenuItemKey(item, index)}>
                    <div className="flex items-stretch">
                      <Link
                        href={item.href}
                        onClick={() => onClose?.()}
                        className="flex min-w-0 flex-1 items-center px-5 py-4 text-md font-bold text-text-body"
                      >
                        <span className="truncate">{item.label}</span>
                      </Link>
                      <button
                        type="button"
                        className="flex shrink-0 items-center justify-center px-5 py-4 text-text-action"
                        aria-label={t('openSubcategoriesFor', { name: item.label })}
                        onClick={() => openNested(item, index)}
                      >
                        <ChevronRight className="w-5 h-5 shrink-0" aria-hidden />
                      </button>
                    </div>
                    <hr className="mx-5 border-border-subtle" />
                  </li>
                );
              }

              return (
                <li key={subMenuItemKey(item, index)}>
                  <span className="flex items-center px-5 py-4 text-md text-text-body">{item.label}</span>
                  <hr className="mx-5 border-border-subtle" />
                </li>
              );
            })}
          </ul>
          {showMobileProductsSeeAll ? (
            <ul>
              <li>
                <Link
                  href="/browse"
                  onClick={() => onClose?.()}
                  className="flex items-center justify-between px-5 py-4 text-md font-bold text-text-action underline"
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
