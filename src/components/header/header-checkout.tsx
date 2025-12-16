'use client';

import { HeaderCartButton } from '@/components/header/cart/header-cart-button';
import { HeaderLogo } from '@/components/header/common/header-logo';
import { HeaderSearchProvider } from '@/components/header/search/search-context';

export function HeaderCheckout() {
  return (
    <HeaderSearchProvider>
      <header className="fixed top-0 left-0 right-0 z-50 sm:pt-4 sm:px-4 lg:px-9 w-full max-w-6xl mx-auto">
        <div className="flex items-center bg-surface-page/95 backdrop-blur-default shadow-sm sm:rounded-lg px-4 sm:px-6 py-2">
          <div className="flex-grow">
            <HeaderLogo scrolled={false} largeImageBreakpoint="sm" />
          </div>
          <HeaderCartButton showSum={true} />
        </div>
      </header>
    </HeaderSearchProvider>
  );
}
