'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Gauge, Menu, Pin, Search, User, UserCheck, X } from 'lucide-react';
import { HeaderCartButton } from '@/components/header/cart/header-cart-button';
import { HeaderIconButton } from '@/components/header/common/header-icon-button';
import { HeaderIconLink } from '@/components/header/common/header-icon-link';
import { HeaderLogo } from '@/components/header/common/header-logo';
import { HeaderNavigation } from '@/components/header/common/header-navigation';
import { HeaderSearch } from '@/components/header/common/header-search';
import { useHeaderSearch } from '@/components/header/search/search-context';
import useAuthDialog from '@/hooks/authentication/useAuthDialog';
import useAuthentication from '@/hooks/authentication/useAuthentication';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { cn } from '@/lib/utils';

interface HeaderActionsProps {
  scrolled: boolean;
}

export function HeaderActionBar({ scrolled }: HeaderActionsProps) {
  const t = useTranslations('layout.header');
  const { showSearch, activateSearch } = useHeaderSearch();
  const isAboveSmallScreen = useBreakpoint('sm');
  const isAboveLargeScreen = useBreakpoint('lg');
  const { isAuthenticated, loading } = useAuthentication();
  const [showMenu, setShowMenu] = useState(false);
  const { openDialog } = useAuthDialog();

  if (loading) {
    // TODO: REMOVE?
    return null;
  }

  return (
    <div
      className={cn(
        'bg-surface-page/95 backdrop-blur-default shadow-sm px-4 py-2 sm:px-6 sm:pt-5 sm:rounded-b-lg sm:group',
        scrolled && 'sm:rounded-t-lg sm:pt-2',
        showMenu && 'sm:h-auto',
      )}
    >
      <div className={cn('flex items-center gap-5 w-full', !scrolled && 'md:justify-between md:flex-wrap')}>
        <div className="flex items-center gap-5 w-full md:justify-between">
          <HeaderLogo scrolled={scrolled} className={cn('me-auto md:me-0', scrolled && 'lg:me-auto')} />
          {isAboveSmallScreen ? (
            <HeaderSearch show={showSearch} small={!isAboveLargeScreen || scrolled} />
          ) : (
            <div className="w-full max-w-180">{/* Skeleton */}</div>
          )}
          <div className={cn('flex items-center gap-5 text-nowrap', showSearch && 'sm:hidden')}>
            {activateSearch && (
              <HeaderIconButton
                className="hidden sm:flex md:hidden"
                icon={Search}
                text={t('shortSearch')}
                onClick={activateSearch}
              />
            )}

            {isAuthenticated ? (
              <HeaderIconLink icon={UserCheck} text={t('account')} href="/account" />
            ) : (
              <HeaderIconButton icon={User} text={t('signIn')} onClick={() => openDialog('login')} />
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
            <HeaderNavigation />
          </div>
          <HeaderCartButton />
          <HeaderIconButton
            className={cn('hidden sm:flex', !scrolled && 'md:hidden')}
            icon={showMenu ? X : Menu}
            text={t('menu')}
            ariaLabel={showMenu ? t('close') : t('menu')}
            onClick={() => setShowMenu(!showMenu)}
          />
        </div>
      </div>

      {/* Navigation Menu */}
      {!showSearch && showMenu && isAboveSmallScreen && (
        <div className="sm:-mx-3 px-3 py-4">
          <HeaderNavigation />
        </div>
      )}
    </div>
  );
}
