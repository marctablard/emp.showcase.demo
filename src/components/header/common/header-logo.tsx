'use client';

import { useTranslations } from 'next-intl';
import { useHeaderSearch } from '@/components/header/search/search-context';
import { breakpoints } from '@/hooks/useBreakpoint';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface HeaderLogoProps {
  scrolled: boolean;
  className?: string;
  title?: string;
  largeImageBreakpoint?: keyof typeof breakpoints;
}

export const HeaderLogo = ({ scrolled, className, title, largeImageBreakpoint }: HeaderLogoProps) => {
  const { showSearch } = useHeaderSearch();
  const t = useTranslations('layout.header');
  const linkTitle = title || t('home');
  const mobileLogo = '/images/logo_small.svg';
  const desktopLogo = '/images/logo.svg';
  largeImageBreakpoint = largeImageBreakpoint || 'md';

  return (
    <Link href="/" title={linkTitle} className={cn('shrink-0', showSearch ? 'sm:hidden' : '', className)}>
      <picture>
        {!scrolled && <source media={`(min-width: ${breakpoints[largeImageBreakpoint]}px)`} srcSet={desktopLogo} />}
        <img
          src={mobileLogo}
          alt="Emporix Shop"
          className={cn(
            'w-[18px] h-[16px] aspect-18/16 md:w-[148px] md:h-[22px] md:aspect-148/22',
            largeImageBreakpoint === 'sm' && 'sm:w-[148px] sm:h-[22px] sm:aspect-148/22',
            scrolled && 'md:w-[25px] md:aspect-25/22',
          )}
        />
      </picture>
    </Link>
  );
};
