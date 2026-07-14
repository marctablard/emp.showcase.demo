import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import type { MenuItem } from '@/data/navigation-menu';
import { navigationMenuItems } from '@/data/navigation-menu';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface HeaderNavigationProps {
  className?: string;
  onMenuToggle?: (item: MenuItem | null) => void;
  activeMenuId?: string | null;
  menuItems?: MenuItem[];
}

export function MenuLevel1({
  className,
  onMenuToggle,
  activeMenuId,
  menuItems = navigationMenuItems,
}: HeaderNavigationProps) {
  const t = useTranslations('layout.header');

  const handleMenuClick = (item: MenuItem) => {
    if (activeMenuId === item.id) {
      onMenuToggle?.(null);
    } else {
      onMenuToggle?.(item);
    }
  };

  return (
    <ul className={cn('flex justify-center items-center gap-8', className)}>
      {menuItems.map((item) => (
        <li key={item.id}>
          {item.href && !item.hasSubmenu ? (
            <Link href={item.href} className="text-lg">
              {t(item.labelKey as any)}
            </Link>
          ) : (
            <button
              type="button"
              className={cn('flex items-center text-lg cursor-pointer', activeMenuId === item.id && 'text-text-action')}
              onClick={() => handleMenuClick(item)}
              aria-expanded={activeMenuId === item.id}
            >
              {t(item.labelKey as any)}
              <ChevronDown
                className={cn('w-5 h-5 ms-1 transition-transform', activeMenuId === item.id && 'rotate-180')}
              />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
