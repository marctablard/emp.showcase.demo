'use client';

import type { SubMenuItem } from '@/data/navigation-menu';
import { HeaderActionBar } from '@/components/header/common/header-action-bar';
import { HeaderDesktopNavigationProvider } from '@/components/header/header-desktop-navigation-context';
import { HeaderMobile } from '@/components/header/common/header-mobile';
import { HeaderTopBanner } from '@/components/header/common/header-top-banner';
import { NavigationProductSubmenuProvider } from '@/components/header/navigation-product-submenu-context';
import { HeaderSearchProvider } from '@/components/header/search/search-context';

export function Header({
  productCategorySubmenu,
  navigationRootCategoryTotal,
}: {
  productCategorySubmenu: SubMenuItem[] | null;
  /** Full count of root categories from the API (used with page size to show "See all"). */
  navigationRootCategoryTotal: number;
}) {
  return (
    <NavigationProductSubmenuProvider
      submenuItems={productCategorySubmenu}
      totalRootCategoryCount={navigationRootCategoryTotal}
    >
      <HeaderDesktopNavigationProvider>
        <HeaderSearchProvider>
          <header className="relative z-60 pointer-events-auto has-[.backdrop-active]:fixed has-[.backdrop-active]:w-full has-[.backdrop-active]:h-full has-[.backdrop-active]:backdrop-blur-default">
            {/* Mobile & Tablet & Desktop */}
            <div className="fixed top-0 left-0 right-0 z-60 sm:pt-4 sm:px-4 md:pt-3 lg:px-9 w-full max-w-6xl mx-auto">
              <HeaderTopBanner />
              <HeaderActionBar />
            </div>
            {/* Mobile */}
            <HeaderMobile />
          </header>
        </HeaderSearchProvider>
      </HeaderDesktopNavigationProvider>
    </NavigationProductSubmenuProvider>
  );
}
