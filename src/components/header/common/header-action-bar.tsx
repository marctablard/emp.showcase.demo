'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Gauge, Menu, Pin, Search, User, UserCheck, X } from 'lucide-react';
import { HeaderCartButton } from '@/components/header/cart/header-cart-button';
import { HeaderIconButton } from '@/components/header/common/header-icon-button';
import { HeaderIconLink } from '@/components/header/common/header-icon-link';
import { HeaderLogo } from '@/components/header/common/header-logo';
import { HeaderSearch } from '@/components/header/common/header-search';
import { DesktopMenuFlyout } from '@/components/header/desktop/menu-flyout';
import { MenuLevel1 } from '@/components/header/desktop/menu-level-1';
import { useHeaderSearch } from '@/components/header/search/search-context';
import { TabletMenuFlyout } from '@/components/header/tablet/menu-flyout';
import { MenuItem } from '@/data/navigation-menu';
import useAuthentication from '@/hooks/authentication/useAuthentication';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export function HeaderActionBar() {
  const t = useTranslations('layout.header');
  const { showSearch, activateSearch } = useHeaderSearch();
  const { isAuthenticated, loading } = useAuthentication();
  const { scrolled } = useHeaderScroll();
  const isAboveSmallScreen = useBreakpoint('sm');
  const isAboveMediumScreen = useBreakpoint('md');
  const isAboveLargeScreen = useBreakpoint('lg');
  const pathname = usePathname();
  const isOnAuthPage = pathname === '/login' || pathname === '/password-reset';
  const [showMenu, setShowMenu] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [activeDesktopMenu, setActiveDesktopMenu] = useState<MenuItem | null>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);
  const menuLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMenuLeave = () => {
    menuLeaveTimeoutRef.current = setTimeout(() => {
      setActiveDesktopMenu(null);
    }, 150);
  };

  const handleMenuHover = (item: MenuItem | null) => {
    if (menuLeaveTimeoutRef.current) {
      clearTimeout(menuLeaveTimeoutRef.current);
      menuLeaveTimeoutRef.current = null;
    }
    // Close flyout immediately when hovering items without submenu
    if (item && !item.hasSubmenu) {
      setActiveDesktopMenu(null);
      return;
    }
    setActiveDesktopMenu(item);
  };

  useEffect(() => {
    // @see https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClient(true);
  }, []);

  useEffect(() => {
    const shouldLockScroll = showMenu && isAboveSmallScreen && !isAboveMediumScreen;
    if (!shouldLockScroll) {
      return;
    }

    const scrollY = window.scrollY;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [showMenu, isAboveSmallScreen, isAboveMediumScreen]);

  useEffect(() => {
    const actionBar = actionBarRef.current;
    const fixedHeaderContainer = actionBar?.parentElement;
    if (!fixedHeaderContainer) {
      return;
    }

    const updateDialogSafeTop = () => {
      const headerHeight = Math.ceil(fixedHeaderContainer.getBoundingClientRect().height);
      // Keep a small visual gap between fixed header and dialog.
      const safeTop = headerHeight + 16;
      document.documentElement.style.setProperty('--dialog-safe-top', `${safeTop}px`);
    };

    updateDialogSafeTop();

    const resizeObserver = new ResizeObserver(updateDialogSafeTop);
    resizeObserver.observe(fixedHeaderContainer);

    window.addEventListener('resize', updateDialogSafeTop, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDialogSafeTop);
    };
  }, [scrolled]);

  return (
    <div
      ref={actionBarRef}
      className={cn(
        'bg-surface-page/95 backdrop-blur-default shadow-sm px-4 py-2 sm:px-6 sm:pt-5 sm:rounded-b-lg sm:group',
        scrolled && 'sm:rounded-t-lg sm:pt-2',
        showMenu && 'sm:h-auto',
      )}
    >
      <div className={cn('flex items-center gap-5 w-full', !scrolled && 'md:justify-between md:flex-wrap')}>
        <div className="flex items-center gap-5 w-full md:justify-between">
          <HeaderLogo scrolled={scrolled} className={cn('me-auto md:me-0', scrolled && 'lg:me-auto')} />
          <HeaderSearch show={showSearch} small={!isAboveLargeScreen || scrolled} />
          <div className={cn('flex items-center gap-5 text-nowrap', showSearch && 'sm:hidden')}>
            {activateSearch && (
              <HeaderIconButton
                className={cn('hidden sm:flex md:hidden', !isClient && 'invisible')}
                icon={Search}
                text={t('shortSearch')}
                onClick={activateSearch}
              />
            )}

            {loading ? (
              <div className="p-0.5">
                {/* Skeleton */}
                <div className="w-8 h-8" />
                <p className="text-sm font-bold -mt-1">&nbsp;</p>
              </div>
            ) : (
              <>
                {isAuthenticated ? (
                  <HeaderIconLink icon={UserCheck} text={t('account')} href="/account" />
                ) : isOnAuthPage ? (
                  <HeaderIconButton icon={User} text={t('signIn')} disabled />
                ) : (
                  <HeaderIconLink icon={User} text={t('signIn')} href="/login" />
                )}
              </>
            )}
            <div className="hidden sm:flex gap-5">
              <HeaderIconLink icon={Gauge} text={t('quickOrder')} href="/#" />
              <HeaderIconLink icon={Pin} text={t('wishlists')} href="/#" />
            </div>
          </div>
        </div>
        <div
          className={cn(
            'flex items-center gap-5',
            showSearch && 'sm:hidden',
            !scrolled && 'md:justify-between md:w-full',
          )}
        >
          <div className={cn('hidden md:block', (showSearch || scrolled) && 'md:hidden')}>
            <MenuLevel1 onMenuHover={handleMenuHover} activeMenuId={activeDesktopMenu?.id} />
          </div>
          <HeaderCartButton />
          <HeaderIconButton
            className={cn('hidden sm:flex', !scrolled && 'md:hidden', !isClient && 'invisible')}
            icon={showMenu ? X : Menu}
            text={t('menu')}
            ariaLabel={showMenu ? t('close') : t('menu')}
            onClick={() => setShowMenu(!showMenu)}
          />
        </div>
      </div>

      {/* Navigation Menu */}
      {!showSearch && showMenu && isAboveSmallScreen && !isAboveMediumScreen && <TabletMenuFlyout />}
      {!showSearch && scrolled && showMenu && isAboveMediumScreen && (
        <div className="flex mt-5">
          <MenuLevel1 onMenuHover={handleMenuHover} activeMenuId={activeDesktopMenu?.id} />
        </div>
      )}
      {!showSearch && activeDesktopMenu && isAboveMediumScreen && (!scrolled || showMenu) && (
        <DesktopMenuFlyout menuItem={activeDesktopMenu} onMouseLeave={handleMenuLeave} />
      )}
    </div>
  );
}
