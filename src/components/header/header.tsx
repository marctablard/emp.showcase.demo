import { getLocale } from 'next-intl/server';
import { HeaderActionBar } from '@/components/header/common/header-action-bar';
import { HeaderMobile } from '@/components/header/common/header-mobile';
import { HeaderTopBanner } from '@/components/header/common/header-top-banner';
import { HeaderSearchProvider } from '@/components/header/search/search-context';
import { SubMenuItem } from '@/data/navigation-menu';
import { getNavCategories } from '@/lib/ssr/category';

export async function Header() {
  let categoryItems: SubMenuItem[] = [];
  try {
    const locale = await getLocale();
    categoryItems = await getNavCategories(locale);
  } catch (error) {
    console.error('Header: failed to load nav categories', error);
  }

  return (
    <HeaderSearchProvider>
      <header className="relative z-60 pointer-events-auto has-[.backdrop-active]:fixed has-[.backdrop-active]:w-full has-[.backdrop-active]:h-full has-[.backdrop-active]:backdrop-blur-default">
        {/* Mobile & Tablet & Desktop */}
        <div className="fixed top-0 left-0 right-0 z-60 sm:pt-4 sm:px-4 md:pt-3 lg:px-9 w-full max-w-6xl mx-auto">
          <HeaderTopBanner />
          <HeaderActionBar categoryItems={categoryItems} />
        </div>
        {/* Mobile */}
        <HeaderMobile categoryItems={categoryItems} />
      </header>
    </HeaderSearchProvider>
  );
}
