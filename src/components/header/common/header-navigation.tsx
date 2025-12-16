import { useTranslations } from 'next-intl';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { navigationMenuItems } from '@/data/navigation-menu';

interface HeaderNavigationProps {
  className?: string;
}

export function HeaderNavigation({ className }: HeaderNavigationProps) {
  const t = useTranslations('layout.header');

  return (
    <NavigationMenu viewport={false} className={className}>
      <NavigationMenuList>
        {navigationMenuItems.map((item) => (
          <NavigationMenuItem key={item.id}>
            {item.hasSubmenu ? (
              <>
                <NavigationMenuTrigger>{t(item.labelKey as any)}</NavigationMenuTrigger>
                <NavigationMenuContent>
                  {item.submenuItems?.map((subItem, index) => (
                    <NavigationMenuLink key={index} href={subItem.href}>
                      {subItem.label}
                    </NavigationMenuLink>
                  ))}
                </NavigationMenuContent>
              </>
            ) : (
              <NavigationMenuLink href={item.href || '#'} className={navigationMenuTriggerStyle()}>
                {t(item.labelKey as any)}
              </NavigationMenuLink>
            )}
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
