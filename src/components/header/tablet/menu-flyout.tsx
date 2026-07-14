'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import type { MenuItem, SubMenuItem } from '@/data/navigation-menu';
import { navigationMenuItems } from '@/data/navigation-menu';
import { Link } from '@/i18n/navigation';

interface NavStackEntry {
  label: string;
  href?: string;
  items: SubMenuItem[];
}

interface TabletMenuFlyoutProps {
  menuItems?: MenuItem[];
}

export function TabletMenuFlyout({ menuItems: menuItemsProp = navigationMenuItems }: TabletMenuFlyoutProps) {
  const t = useTranslations('layout.header');

  const menuItems = menuItemsProp.map((item) => ({
    ...item,
    label: t(item.labelKey as any),
  }));

  const [navStack, setNavStack] = useState<NavStackEntry[]>([]);

  const currentItems = navStack.length > 0 ? navStack[navStack.length - 1].items : null;
  const currentEntry = navStack.length > 0 ? navStack[navStack.length - 1] : null;

  const openSubmenu = (label: string, href: string | undefined, items: SubMenuItem[]) => {
    setNavStack((prev) => [...prev, { label, href, items }]);
  };

  const handleTopLevelDrill = (item: (typeof menuItems)[0]) => {
    if (item.hasSubmenu && item.submenuItems) {
      openSubmenu(item.label, item.href, item.submenuItems);
    }
  };

  const handleSubmenuDrill = (item: SubMenuItem) => {
    if (item.hasSubmenu && item.submenuItems) {
      openSubmenu(item.label, item.href, item.submenuItems);
    }
  };

  const handleBack = () => {
    setNavStack((prev) => prev.slice(0, -1));
  };

  return (
    <div className="backdrop-active mt-6 mb-4">
      {navStack.length === 0 ? (
        <ul>
          {menuItems.map((item) => (
            <li key={item.id}>
              {item.hasSubmenu ? (
                <>
                  <div className="flex items-center justify-between py-4 text-lg">
                    {item.href ? (
                      <Link href={item.href} className="flex-1">
                        {item.label}
                      </Link>
                    ) : (
                      <span className="flex-1">{item.label}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleTopLevelDrill(item)}
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
      ) : (
        <>
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleBack} className="flex items-center gap-2">
                <ArrowLeft className="w-5 h-5 text-text-action" />
              </button>
              {currentEntry?.href ? (
                <Link href={currentEntry.href} className="text-lg font-medium">
                  {currentEntry.label}
                </Link>
              ) : (
                <span className="text-lg font-medium">{currentEntry?.label}</span>
              )}
            </div>
            <hr className="border-border-subtle" />
          </div>
          <ul className="divide-y divide-border-subtle">
            {currentItems?.map((item, index) => (
              <li key={`${item.label}-${index}`}>
                {item.hasSubmenu ? (
                  <div className="flex items-center justify-between py-2 text-md">
                    <Link href={item.href} className="flex-1">
                      {item.label}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleSubmenuDrill(item)}
                      className="cursor-pointer ps-2"
                      aria-label={`Open ${item.label} subcategories`}
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <Link href={item.href} className="flex items-center justify-between py-2 text-md">
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
