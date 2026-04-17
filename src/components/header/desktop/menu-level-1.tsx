import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import type { MenuItem } from '@/data/navigation-menu';
import { navigationMenuItems } from '@/data/navigation-menu';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface HeaderNavigationProps {
  className?: string;
  onMenuHover?: (item: MenuItem | null) => void;
  activeMenuId?: string | null;
}

export function MenuLevel1({ className, onMenuHover, activeMenuId }: HeaderNavigationProps) {
  const t = useTranslations('layout.header');

  const handleMenuClick = (item: MenuItem) => {
    if (activeMenuId === item.id) {
      onMenuHover?.(null);
    } else {
      onMenuHover?.(item);
    }
  };

  return (
    <ul className={cn('flex justify-center items-center gap-8', className)}>
      {navigationMenuItems.map((item) => (
        <li key={item.id}>
          {item.href && !item.hasSubmenu ? (
            <>
              <Link href={item.href} className="text-lg" onMouseEnter={() => onMenuHover?.(item)}>
                {t(item.labelKey as any)}
              </Link>
            </>
          ) : (
            <>
              <button
                className={cn(
                  'flex items-center text-lg cursor-pointer',
                  activeMenuId === item.id && 'text-text-action',
                )}
                onMouseEnter={() => onMenuHover?.(item)}
                onClick={() => handleMenuClick(item)}
              >
                {t(item.labelKey as any)}
                <ChevronDown className="w-5 h-5 ms-1" />
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
