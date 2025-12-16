'use client';

import { HeaderActionBar } from '@/components/header/common/header-action-bar';
import { HeaderMobile } from '@/components/header/common/header-mobile';
import { HeaderTopBanner } from '@/components/header/common/header-top-banner';
import { HeaderSearchProvider } from '@/components/header/search/search-context';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';

export function Header() {
  const { scrolled } = useHeaderScroll();
  return (
    <HeaderSearchProvider>
      <header className="has-[.search]:fixed has-[.search]:w-full has-[.search]:h-full has-[.search]:backdrop-blur-default has-[.search]:z-60">
        {/* Mobile & Tablet & Desktop */}
        <div className="fixed top-0 left-0 right-0 z-50 sm:pt-4 sm:px-4 md:pt-3 lg:px-9 w-full max-w-6xl mx-auto">
          <HeaderTopBanner scrolled={scrolled} />
          <HeaderActionBar scrolled={scrolled} />
        </div>
        {/* Mobile */}
        <div className="sm:hidden">
          <HeaderMobile />
        </div>
      </header>
    </HeaderSearchProvider>
  );
}
