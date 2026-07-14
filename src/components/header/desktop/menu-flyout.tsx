'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { MenuItem, SubMenuItem } from '@/data/navigation-menu';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface DesktopMenuFlyoutProps {
  menuItem: MenuItem;
  onClose?: () => void;
}

function buildColumns(submenuItems: SubMenuItem[], selectedPath: SubMenuItem[]): SubMenuItem[][] {
  const columns: SubMenuItem[][] = [submenuItems];
  for (const item of selectedPath) {
    if (item.submenuItems && item.submenuItems.length > 0) {
      columns.push(item.submenuItems);
    }
  }
  return columns;
}

export function DesktopMenuFlyout({ menuItem, onClose }: DesktopMenuFlyoutProps) {
  const [selectedPath, setSelectedPath] = useState<SubMenuItem[]>([]);
  const [prevMenuItem, setPrevMenuItem] = useState(menuItem);

  if (menuItem !== prevMenuItem) {
    setPrevMenuItem(menuItem);
    setSelectedPath([]);
  }

  const submenuItems = menuItem.submenuItems ?? [];
  const columns = buildColumns(submenuItems, selectedPath);

  const handleItemSelect = (level: number, item: SubMenuItem) => {
    if (!item.hasSubmenu) {
      return;
    }
    setSelectedPath((prev) => [...prev.slice(0, level), item]);
  };

  return (
    <div className="backdrop-active flex gap-0 pt-6 -mb-2 pb-6 -mx-6 px-6">
      {columns.map((items, level) => (
        <ul
          key={level}
          className={cn(
            'min-w-[220px] divide-y divide-border-subtle',
            level > 0 && 'ps-2 border-s-1 border-s-border-subtle',
          )}
        >
          {items.map((item, index) => {
            const isSelected = selectedPath[level] === item;

            return (
              <li key={`${level}-${index}`}>
                {item.hasSubmenu ? (
                  <div
                    className={cn(
                      'flex items-center rounded-sm hover:bg-surface-action-hover-2',
                      isSelected && 'bg-surface-action-hover-2',
                    )}
                  >
                    <Link href={item.href} className="flex-1 px-4 py-2 text-md" onClick={() => onClose?.()}>
                      {item.label}
                    </Link>
                    <button
                      type="button"
                      className="px-2 py-2 cursor-pointer"
                      onClick={() => handleItemSelect(level, item)}
                      aria-label={`Open ${item.label} subcategories`}
                      aria-expanded={isSelected}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    className="flex items-center justify-between px-4 py-2 text-md rounded-sm hover:bg-surface-action-hover-2"
                    onClick={() => onClose?.()}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}
