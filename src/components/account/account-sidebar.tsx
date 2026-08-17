'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { SidebarGroup } from '@/components/ui/sidebar-group';
import { SidebarNavLink } from '@/components/ui/sidebar-nav-link';
import { useAuthentication } from '@/hooks/authentication/useAuthentication';
import { cn } from '@/lib/utils';

interface SidebarItem {
  href: string;
  title: string;
  icon?: React.ReactNode;
  counter?: number;
  badgeVariant?: 'primary' | 'success';
}

interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: SidebarItem[];
  groups?: SidebarGroup[];
  scrollable?: boolean;
}

export function AccountSidebar({ className, items, groups = [], scrollable = true, ...props }: SidebarNavProps) {
  const pathname = usePathname();
  const { logout } = useAuthentication();
  const locale = useLocale();

  const renderSidebarLink = (item: SidebarItem) => {
    if (item.href === '/account/logout') {
      return (
        <SidebarNavLink
          key={item.href}
          href={item.href}
          icon={item.icon}
          text={item.title}
          counter={item.counter}
          badgeVariant={item.badgeVariant}
          isLogout={true}
          onClick={() => logout()}
        />
      );
    }

    const href = item.href;
    // Check if active prop is provided or determine based on path with locale handling
    const isActive = pathname === `/${locale}${item.href}` || pathname === item.href;

    return (
      <SidebarNavLink
        key={item.href}
        href={href}
        icon={item.icon}
        text={item.title}
        counter={item.counter}
        badgeVariant={item.badgeVariant}
        active={isActive}
      />
    );
  };

  return (
    <nav
      className={cn(
        'flex flex-col min-w-[180px] md:min-w-[288px] items-start rounded-md h-full py-4 shadow-sm',
        // COP-4998: tablet rail needs a real overflow scrollport when <main> is shorter
        // than the ~1272px nav (Figma 3394:81472 / 6354:68313). Subtract DefaultMainLayout
        // sm:mt-36 (9rem) / md:mt-52 (13rem) plus Account row mt-4 + mb-4 (1rem each).
        // min-h-0 so flex min-height:auto cannot defeat max-h. Drawer keeps scrollable={false}.
        scrollable &&
          'overflow-y-auto min-h-0 overscroll-contain max-h-[calc(100dvh-11rem)] md:max-h-[calc(100dvh-15rem)]',
        className,
      )}
      {...props}
    >
      {/* Regular items (no group) */}
      {items.map(renderSidebarLink)}

      {/* Groups */}
      {groups.map((group) => (
        <SidebarGroup key={group.title} title={group.title}>
          {group.items.map(renderSidebarLink)}
        </SidebarGroup>
      ))}
    </nav>
  );
}

export default AccountSidebar;
