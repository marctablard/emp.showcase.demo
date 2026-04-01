'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ChevronDown, MapPin } from 'lucide-react';
import { HeaderPromo } from '@/components/header/common/header-promo';
import { LocationSettingsDialog } from '@/components/header/mobile/location-settings-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MenuItem, navigationMenuItems, serviceMenuItems } from '@/data/navigation-menu';
import { Link } from '@/i18n/navigation';

interface MobileMenuNavigationProps {
  onClose?: () => void;
  menuItems?: MenuItem[];
}

export function MobileMenuNavigation({
  onClose,
  menuItems: menuItemsProp = navigationMenuItems,
}: MobileMenuNavigationProps) {
  const t = useTranslations('layout.header');

  // Transform menu items with translations
  const menuItems = menuItemsProp.map((item) => ({
    ...item,
    label: t(item.labelKey as any),
  }));

  // Transform service items with translations
  const serviceItems = serviceMenuItems.map((item) => ({
    ...item,
    label: t(item.labelKey as any),
  }));

  const [currentView, setCurrentView] = useState<'main' | string>('main');
  const [secondLevelLabel, setSecondLevelLabel] = useState<string>('');
  const [showLocationSettings, setShowLocationSettings] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const getItemsForView = (view: string) => {
    if (view === 'main') {
      return menuItems;
    }
    const findSubmenu = (items: any[], targetId: string): any[] | null => {
      for (const item of items) {
        if (item.id === targetId || item.label === targetId) {
          return item.submenuItems || [];
        }
        if (item.submenuItems) {
          const found = findSubmenu(item.submenuItems, targetId);
          if (found) return found;
        }
      }
      return null;
    };
    return findSubmenu(menuItems, view) || [];
  };

  const handleItemClick = (item: any) => {
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

  const mainItems = getItemsForView('main');
  const secondLevelItems = currentView !== 'main' ? getItemsForView(currentView) : [];

  // Shared render function for menu items
  const renderMenuItems = (items: any[], isSecondLevel: boolean) => (
    <ul>
      {items.map((item, index) => (
        <li key={item.id || item.label || index}>
          {item.href && !item.hasSubmenu ? (
            <>
              <Link
                href={item.href}
                onClick={() => (isSecondLevel ? onClose?.() : handleItemClick(item))}
                className={`flex items-center justify-between px-5 py-4 ${isSecondLevel ? 'text-md font-bold' : 'text-lg'}`}
              >
                {item.label}
              </Link>
              {!isSecondLevel && <hr className="mx-5 border-border-subtle" />}
            </>
          ) : isSecondLevel && item.submenuItems && item.submenuItems.length > 0 ? (
            <Collapsible
              open={expandedItems.has(item.id || item.label)}
              onOpenChange={() => toggleExpanded(item.id || item.label)}
            >
              <CollapsibleTrigger className="w-full flex items-center justify-between px-5 py-4 text-md font-bold cursor-pointer">
                {item.label}
                <ChevronDown
                  className={`w-5 h-5 transition-transform ${expandedItems.has(item.id || item.label) ? 'rotate-180' : ''}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul>
                  {item.submenuItems.map((subItem: any, subIndex: number) => (
                    <li key={subItem.id || subItem.label || subIndex}>
                      {subItem.href ? (
                        <Link
                          href={subItem.href}
                          onClick={() => onClose?.()}
                          className="flex items-center justify-between pl-10 pr-5 py-3 text-base"
                        >
                          {subItem.label}
                        </Link>
                      ) : (
                        <span className="flex items-center justify-between pl-10 pr-5 py-3 text-base">
                          {subItem.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          ) : !isSecondLevel && item.hasSubmenu ? (
            <>
              <div className="flex items-center justify-between px-5 text-lg">
                <Link href={item.href || '#'} onClick={() => onClose?.()} className="flex-1 py-4">
                  {item.label}
                </Link>
                <button
                  onClick={() => handleItemClick(item)}
                  className="cursor-pointer ps-3 py-4"
                  aria-label={`Open ${item.label} subcategories`}
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
              <hr className="mx-5 border-border-subtle" />
            </>
          ) : (
            <Link
              href={item.href || '#'}
              onClick={() => onClose?.()}
              className={`flex items-center justify-between px-5 py-4 ${isSecondLevel ? 'text-md font-bold' : 'text-lg'}`}
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
        {/* Main panel */}
        <div className="w-full flex-shrink-0 bg-surface-page overflow-y-auto">
          {renderMenuItems(mainItems, false)}

          {/* Service & Contact Group */}
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

          {/* Location Settings */}
          <ul>
            <li>
              <div className="px-5 pt-8 font-semibold text-base text-text-placeholders">{t('settings')}</div>
            </li>
            <li>
              <button
                onClick={() => setShowLocationSettings(true)}
                className="w-full flex items-center justify-between px-5 py-4 text-md cursor-pointer"
              >
                {t('locationSettings')}
                <MapPin className="w-5 h-5" />
              </button>
            </li>
          </ul>

          <HeaderPromo />
        </div>

        {/* Second level panel */}
        <div className="w-full flex-shrink-0 bg-surface-page overflow-y-auto">
          {/* Back button */}
          <div className="flex items-center gap-3 px-4 py-4">
            <button onClick={handleBack} className="flex items-center gap-2">
              <ArrowLeft className="w-5 h-5 text-text-action" />
            </button>
            {(() => {
              const activeItem = menuItems.find((m) => m.id === currentView || m.label === currentView);
              return activeItem?.href ? (
                <Link href={activeItem.href} onClick={() => onClose?.()} className="text-lg font-medium">
                  {secondLevelLabel || 'Back'}
                </Link>
              ) : (
                <span className="text-lg font-medium">{secondLevelLabel || 'Back'}</span>
              );
            })()}
          </div>
          <hr className="mx-5 border-border-subtle" />

          {renderMenuItems(secondLevelItems, true)}
        </div>
      </nav>

      {/* Location Settings Dialog */}
      <LocationSettingsDialog open={showLocationSettings} onOpenChange={setShowLocationSettings} />
    </div>
  );
}
