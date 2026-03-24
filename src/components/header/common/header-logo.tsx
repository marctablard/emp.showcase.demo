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
          alt="Franke"
          className={cn(
            'w-[32px] h-[32px] aspect-square md:w-[130px] md:h-[42px] md:aspect-[130/42]',
            largeImageBreakpoint === 'sm' && 'sm:w-[130px] sm:h-[42px] sm:aspect-[130/42]',
            scrolled && 'md:w-[40px] md:h-[40px] md:aspect-square',
          )}
        />
      </picture>
    </Link>
  );
};
