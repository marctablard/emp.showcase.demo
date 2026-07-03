import { HeaderActionBar } from '@/components/header/common/header-action-bar';
import { HeaderMobile } from '@/components/header/common/header-mobile';
import { HeaderTopBanner } from '@/components/header/common/header-top-banner';
import { HeaderSearchProvider } from '@/components/header/search/search-context';

export function Header() {
  return (
    <HeaderSearchProvider>
      <header className="relative z-60 pointer-events-auto has-[.backdrop-active]:fixed has-[.backdrop-active]:w-full has-[.backdrop-active]:h-full has-[.backdrop-active]:backdrop-blur-default">
        {/* Mobile & Tablet & Desktop */}
        <div className="fixed top-0 left-0 right-0 z-60 sm:pt-4 sm:px-4 md:px-9 w-full max-w-6xl mx-auto">
          <HeaderTopBanner />
          <HeaderActionBar />
        </div>
        {/* Mobile */}
        <HeaderMobile />
      </header>
    </HeaderSearchProvider>
  );
}
