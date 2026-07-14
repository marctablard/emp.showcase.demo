'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ChevronDown, MapPin } from 'lucide-react';
import { LocationSettingsDialog } from '@/components/header/mobile/location-settings-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { MenuItem, SubMenuItem } from '@/data/navigation-menu';
import { navigationMenuItems, serviceMenuItems } from '@/data/navigation-menu';
import { Link } from '@/i18n/navigation';

interface NavStackEntry {
  label: string;
  href?: string;
  items: SubMenuItem[];
}

interface MobileMenuNavigationProps {
  onClose?: () => void;
  menuItems?: MenuItem[];
}

export function MobileMenuNavigation({
  onClose,
  menuItems: menuItemsProp = navigationMenuItems,
}: MobileMenuNavigationProps) {
  const t = useTranslations('layout.header');

  const menuItems = menuItemsProp.map((item) => ({
    ...item,
    label: t(item.labelKey as any),
  }));

  const serviceItems = serviceMenuItems.map((item) => ({
    ...item,
    label: t(item.labelKey as any),
  }));

  const [navStack, setNavStack] = useState<NavStackEntry[]>([]);
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

  const openSubmenu = (label: string, href: string | undefined, items: SubMenuItem[]) => {
    setNavStack((prev) => [...prev, { label, href, items }]);
    setExpandedItems(new Set());
  };

  const handleBack = () => {
    if (navStack.length > 0) {
      setNavStack((prev) => prev.slice(0, -1));
      setExpandedItems(new Set());
    }
  };

  const getItemKey = (item: SubMenuItem, index: number) => `${item.href}-${item.label}-${index}`;

  const renderSubMenuItems = (items: SubMenuItem[], depth = 0) => (
    <ul className="divide-y divide-border-subtle">
      {items.map((item, index) => {
        const itemKey = getItemKey(item, index);
        const hasChildren = item.hasSubmenu && item.submenuItems && item.submenuItems.length > 0;

        if (hasChildren) {
          return (
            <li key={itemKey}>
              <Collapsible open={expandedItems.has(itemKey)} onOpenChange={() => toggleExpanded(itemKey)}>
                <div className="flex items-center justify-between">
                  <Link
                    href={item.href}
                    onClick={() => onClose?.()}
                    className="flex-1 px-5 py-4 text-md"
                    style={{ paddingLeft: `${20 + depth * 20}px` }}
                  >
                    {item.label}
                  </Link>
                  <CollapsibleTrigger
                    className="cursor-pointer px-5 py-4"
                    aria-label={`Expand ${item.label} subcategories`}
                  >
                    <ChevronDown
                      className={`w-5 h-5 transition-transform ${expandedItems.has(itemKey) ? 'rotate-180' : ''}`}
                    />
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>{renderSubMenuItems(item.submenuItems!, depth + 1)}</CollapsibleContent>
              </Collapsible>
            </li>
          );
        }

        return (
          <li key={itemKey}>
            <Link
              href={item.href}
              onClick={() => onClose?.()}
              className="flex items-center justify-between px-5 py-4 text-md"
              style={{ paddingLeft: `${20 + depth * 20}px` }}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const currentPanel = navStack.length > 0 ? navStack[navStack.length - 1] : null;

  return (
    <div className="flex overflow-hidden">
      <nav
        className={`w-full flex transition-transform duration-300 ease-in-out ${navStack.length > 0 ? '-translate-x-full' : 'translate-x-0'}`}
      >
        {/* Main panel */}
        <div className="w-full flex-shrink-0 bg-surface-page overflow-y-auto">
          <ul>
            {menuItems.map((item) => (
              <li key={item.id}>
                {item.hasSubmenu ? (
                  <>
                    <div className="flex items-center justify-between px-5 text-lg">
                      {item.href ? (
                        <Link href={item.href} onClick={() => onClose?.()} className="flex-1 py-4">
                          {item.label}
                        </Link>
                      ) : (
                        <span className="flex-1 py-4">{item.label}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => openSubmenu(item.label, item.href, item.submenuItems ?? [])}
                        className="cursor-pointer ps-3 py-4"
                        aria-label={`Open ${item.label} subcategories`}
                      >
                        <ChevronDown className="w-5 h-5" />
                      </button>
                    </div>
                    <hr className="mx-5 border-border-subtle" />
                  </>
                ) : (
                  <>
                    <Link
                      href={item.href ?? '#'}
                      onClick={() => onClose?.()}
                      className="flex items-center justify-between px-5 py-4 text-lg"
                    >
                      {item.label}
                    </Link>
                    <hr className="mx-5 border-border-subtle" />
                  </>
                )}
              </li>
            ))}
          </ul>

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
                <MapPin className="w-5 h-5" />
              </button>
            </li>
          </ul>
        </div>

        {/* Submenu panel */}
        <div className="w-full flex-shrink-0 bg-surface-page overflow-y-auto">
          <div className="flex items-center gap-3 px-4 py-4">
            <button type="button" onClick={handleBack} className="flex items-center gap-2">
              <ArrowLeft className="w-5 h-5 text-text-action" />
            </button>
            {currentPanel?.href ? (
              <Link href={currentPanel.href} onClick={() => onClose?.()} className="text-lg font-medium">
                {currentPanel.label}
              </Link>
            ) : (
              <span className="text-lg font-medium">{currentPanel?.label}</span>
            )}
          </div>
          <hr className="mx-5 border-border-subtle" />

          {currentPanel && renderSubMenuItems(currentPanel.items)}
        </div>
      </nav>

      <LocationSettingsDialog open={showLocationSettings} onOpenChange={setShowLocationSettings} />
    </div>
  );
}
