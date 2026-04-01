'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { HeaderPromo } from '@/components/header/common/header-promo';
import { MenuItem, navigationMenuItems } from '@/data/navigation-menu';
import { Link } from '@/i18n/navigation';

interface TabletMenuFlyoutProps {
  menuItems?: MenuItem[];
}

export function TabletMenuFlyout({ menuItems: menuItemsProp = navigationMenuItems }: TabletMenuFlyoutProps) {
  const t = useTranslations('layout.header');

  // Transform menu items with translations
  const menuItems = menuItemsProp.map((item) => ({
    ...item,
    label: t(item.labelKey as any),
  }));

  const [currentView, setCurrentView] = useState<'main' | string>('main');
  const [selectedItem, setSelectedItem] = useState<(typeof menuItems)[0] | null>(null);

  const handleItemClick = (item: (typeof menuItems)[0]) => {
    if (item.hasSubmenu) {
      setSelectedItem(item);
      setCurrentView(item.id);
    }
  };

  const handleBack = () => {
    setCurrentView('main');
    setSelectedItem(null);
  };

  return (
    <div className="backdrop-active grid mt-6 mb-4">
      {/* 1st level view */}
      <div
        className={`col-start-1 row-start-1 grid grid-cols-3 gap-2 transition-opacity duration-300 ${currentView !== 'main' ? 'opacity-0 invisible' : 'opacity-100 visible'}`}
      >
        <ul>
          {menuItems.map((item) => (
            <li key={item.id}>
              {item.hasSubmenu ? (
                <>
                  <div className="flex items-center justify-between py-4 text-lg">
                    <Link href={item.href ?? '#'} className="flex-1">
                      {item.label}
                    </Link>
                    <button
                      onClick={() => handleItemClick(item)}
                      className="cursor-pointer ps-2"
                      aria-label={`Open ${item.label} subcategories`}
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  </div>
                  <hr className="border-border-subtle" />
                </>
              ) : (
                <>
                  <Link href={item.href ?? '#'} className="flex items-center justify-between py-4 text-lg">
                    {item.label}
                  </Link>
                  <hr className="border-border-subtle" />
                </>
              )}
            </li>
          ))}
        </ul>
        <HeaderPromo className="col-span-2" />
      </div>

      {/* 2nd level view */}
      <div
        className={`col-start-1 row-start-1 grid grid-cols-3 gap-2 gap-y-6 transition-opacity duration-300 ${currentView === 'main' ? 'opacity-0 invisible' : 'opacity-100 visible'}`}
      >
        {/* Back button */}
        <div className="col-span-3 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <button onClick={handleBack} className="flex items-center gap-2">
              <ArrowLeft className="w-5 h-5 text-text-action" />
            </button>
            {selectedItem?.href ? (
              <Link href={selectedItem.href} className="text-lg font-medium">
                {selectedItem.label}
              </Link>
            ) : (
              <span className="text-lg font-medium">{selectedItem?.label}</span>
            )}
          </div>
          <hr className="border-border-subtle" />
        </div>
        <ul>
          {selectedItem?.submenuItems?.map((item, index) => (
            <li key={index}>
              {item.href && (
                <Link href={item.href} className="flex items-center justify-between py-2 text-md">
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
        <HeaderPromo className="col-span-2" />
      </div>
    </div>
  );
}
