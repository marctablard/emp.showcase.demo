'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { HeaderPromo } from '@/components/header/common/header-promo';
import { MenuItem, SubMenuItem } from '@/data/navigation-menu';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface DesktopMenuFlyoutProps {
  menuItem: MenuItem;
  onMouseLeave?: () => void;
}

export function DesktopMenuFlyout({ menuItem, onMouseLeave }: DesktopMenuFlyoutProps) {
  const [hoveredSubItem, setHoveredSubItem] = useState<SubMenuItem | null>(null);
  const [prevMenuItem, setPrevMenuItem] = useState(menuItem);

  // Reset 3rd level when switching 1st level menu items
  if (menuItem !== prevMenuItem) {
    setPrevMenuItem(menuItem);
    setHoveredSubItem(null);
  }

  const submenuItems = menuItem.submenuItems ?? [];
  const thirdLevelItems = hoveredSubItem?.submenuItems ?? [];

  const handleSubItemClick = (item: SubMenuItem) => {
    if (hoveredSubItem === item) {
      setHoveredSubItem(null);
    } else {
      setHoveredSubItem(item);
    }
  };

  return (
    <div className="backdrop-active grid grid-cols-4 gap-2 pt-6 -mb-2 pb-6 -mx-6 px-6" onMouseLeave={onMouseLeave}>
      <ul>
        {/* 2nd level */}
        {submenuItems.map((item, index) => (
          <li key={index}>
            {item.hasSubmenu ? (
              <div
                className={cn(
                  'flex items-center rounded-sm hover:bg-surface-action-hover-2',
                  hoveredSubItem === item && 'bg-surface-action-hover-2',
                )}
                onMouseEnter={() => setHoveredSubItem(item)}
              >
                <Link
                  href={item.href}
                  className="flex-1 px-4 py-2 text-md font-bold"
                  onClick={() => handleSubItemClick(item)}
                >
                  {item.label}
                </Link>
                <button
                  className="px-2 py-2 cursor-pointer"
                  onClick={() => handleSubItemClick(item)}
                  aria-label={`Open ${item.label} subcategories`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <Link
                href={item.href}
                className="flex items-center justify-between px-4 py-2 text-md font-bold rounded-sm hover:bg-surface-action-hover-2"
                onMouseEnter={() => setHoveredSubItem(null)}
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
      {/* 3rd level */}
      <ul className="ps-2 border-s-1 border-s-border-subtle">
        {thirdLevelItems.map((item, index) => (
          <li key={index}>
            {item.href && (
              <>
                <Link
                  href={item.href}
                  className="flex items-center justify-between px-4 py-2 text-md rounded-sm hover:bg-surface-action-hover-2"
                >
                  {item.label}
                </Link>
              </>
            )}
          </li>
        ))}
      </ul>
      <HeaderPromo className="col-span-2 col-start-3" />
    </div>
  );
}
