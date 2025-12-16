'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChevronDown, ChevronLeft, MapPin } from 'lucide-react';
import { LocationSettingsDialog } from '@/components/header/mobile/location-settings-dialog';
import { navigationMenuItems, serviceMenuItems } from '@/data/navigation-menu';

interface MobileMenuNavigationProps {
  onClose?: () => void;
}

export function MobileMenuNavigation({ onClose }: MobileMenuNavigationProps) {
  const t = useTranslations('layout.header');

  // Transform menu items with translations
  const menuItems = navigationMenuItems.map((item) => ({
    ...item,
    label: t(item.labelKey as any),
  }));

  // Transform service items with translations
  const serviceItems = serviceMenuItems.map((item) => ({
    ...item,
    label: t(item.labelKey as any),
  }));

  const [currentView, setCurrentView] = useState<'main' | string>('main');
  const [breadcrumb, setBreadcrumb] = useState<Array<{ id: string; label: string }>>([]);
  const [showLocationSettings, setShowLocationSettings] = useState(false);

  const handleItemClick = (item: any) => {
    if (item.hasSubmenu) {
      setBreadcrumb([...breadcrumb, { id: item.id || item.label, label: item.label }]);
      setCurrentView(item.id || item.label);
    } else if (item.href) {
      onClose?.();
    }
  };

  const handleBack = () => {
    if (breadcrumb.length > 0) {
      const newBreadcrumb = [...breadcrumb];
      newBreadcrumb.pop();
      setBreadcrumb(newBreadcrumb);
      setCurrentView(newBreadcrumb.length > 0 ? newBreadcrumb[newBreadcrumb.length - 1].id : 'main');
    }
  };

  const getCurrentItems = () => {
    if (currentView === 'main') {
      return menuItems;
    }

    // Find the submenu items based on current view
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

    return findSubmenu(menuItems, currentView) || [];
  };

  const currentItems = getCurrentItems();

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      {currentView !== 'main' && (
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-text-action hover:text-text-action-hover"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-lg font-medium">{breadcrumb[breadcrumb.length - 1]?.label || 'Back'}</span>
          </button>
          <hr className="mx-5 border-border-subtle" />
        </div>
      )}

      {/* Menu items */}
      <nav className="flex-1 overflow-y-auto py-2">
        <ul>
          {currentItems.map((item, index) => (
            <li key={item.id || item.label || index}>
              {item.href && !item.hasSubmenu ? (
                <Link
                  href={item.href}
                  onClick={() => handleItemClick(item)}
                  className="flex items-center justify-between px-5 py-4 text-lg"
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  onClick={() => handleItemClick(item)}
                  className="w-full flex items-center justify-between px-5 py-4 text-lg cursor-pointer"
                >
                  {item.label}
                  {item.hasSubmenu && <ChevronDown className="w-5 h-5 -rotate-90" />}
                </button>
              )}
              <hr className="mx-5 border-border-subtle" />
            </li>
          ))}
        </ul>

        {/* Service & Contact Group - only show on main view */}
        {currentView === 'main' && (
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
                    className="flex items-center justify-between px-5 py-4 text-lg"
                  >
                    {item.label}
                  </Link>
                )}
                <hr className="mx-5 border-border-subtle" />
              </li>
            ))}
          </ul>
        )}

        {/* Location Settings - only show on main view */}
        {currentView === 'main' && (
          <ul>
            <li>
              <div className="px-5 pt-8 font-semibold text-base text-text-placeholders">{t('settings')}</div>
            </li>
            <li>
              <button
                onClick={() => setShowLocationSettings(true)}
                className="w-full flex items-center justify-between px-5 py-4 text-lg cursor-pointer"
              >
                {t('locationSettings')}
                <MapPin className="w-5 h-5" />
              </button>
            </li>
          </ul>
        )}
      </nav>

      {/* Location Settings Dialog */}
      <LocationSettingsDialog open={showLocationSettings} onOpenChange={setShowLocationSettings} />
    </div>
  );
}
