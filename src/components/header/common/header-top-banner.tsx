'use client';

import { useTranslations } from 'next-intl';
import TopBannerAnnouncement from '@/components/cms/top-banner-announcement';
import { CompanySwitcher } from '@/components/header/switcher/header-company-switcher';
import { CurrencySwitcher } from '@/components/header/switcher/header-currency-switcher';
import { LanguageSwitcher } from '@/components/header/switcher/header-language-switcher';
import { SiteSwitcher } from '@/components/header/switcher/header-site-switcher';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export function HeaderTopBanner() {
  const t = useTranslations('layout.header');
  const { scrolled } = useHeaderScroll();
  const isAboveLargeScreen = useBreakpoint('lg');
  return (
    <div
      className={cn(
        'hidden sm:flex items-center -mx-2 lg:-mx-4 -mb-1 h-8 px-8 lg:px-10 relative z-10 bg-surface-action text-text-on-action shadow-sm rounded-lg',
        scrolled && 'sm:hidden',
      )}
    >
      <div className="flex justify-between items-center self-stretch w-full">
        <div className="flex grow basis-0 shrink-0 gap-4 items-center">
          <SiteSwitcher />
          <hr className="w-px h-6 bg-surface-page" />
          <LanguageSwitcher />
          <hr className="w-px h-6 bg-surface-page" />
          <CurrencySwitcher />
          <CompanySwitcher />
        </div>
        {isAboveLargeScreen && (
          <div className="justify-center items-center font-bold">
            <TopBannerAnnouncement />
          </div>
        )}
        <nav
          className="flex grow basis-0 shrink-0 justify-end items-center gap-6 text-nowrap"
          aria-label={t('navigation.meta')}
        >
          <Link href="/blog">{t('blog')}</Link>
          <Link href="/newsletter">{t('newsletter')}</Link>
          <Link href="/offer-request">{t('offerRequest')}</Link>
          <Link href="/contact">{t('contact')}</Link>
        </nav>
      </div>
    </div>
  );
}
