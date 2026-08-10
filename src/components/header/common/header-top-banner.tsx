'use client';

import { useTranslations } from 'next-intl';
import TopBannerAnnouncement from '@/components/cms/top-banner-announcement';
import { useHeaderDesktopNavigation } from '@/components/header/header-desktop-navigation-context';
import { CompanySwitcher } from '@/components/header/switcher/header-company-switcher';
import { CurrencySwitcher } from '@/components/header/switcher/header-currency-switcher';
import { LanguageSwitcher } from '@/components/header/switcher/header-language-switcher';
import { SiteSwitcher } from '@/components/header/switcher/header-site-switcher';
import { useBanner } from '@/hooks/banner/use-banner';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

function HeaderTopBannerAnnouncement() {
  const { data, isLoading } = useBanner();

  if (isLoading || !data) {
    return null;
  }

  const content = data.story?.content;

  if (!content) {
    return null;
  }

  return (
    <TopBannerAnnouncement
      id="top-banner-announcement"
      type="top-banner-announcement"
      title={content.title}
      link={content.link}
      is_active={content.is_active}
    />
  );
}

export function HeaderTopBanner() {
  const t = useTranslations('layout.header');
  const { scrolled } = useHeaderScroll();
  const isAboveDesktopFlyoutBreakpoint = useBreakpoint('md');
  const { dismissFlyout } = useHeaderDesktopNavigation();
  return (
    <div
      className={cn(
        'hidden sm:flex items-center -mx-2 md:-mx-4 -mb-1 h-8 px-8 md:px-10 relative z-10 bg-surface-action text-text-on-action shadow-sm rounded-lg',
        scrolled && 'sm:hidden',
      )}
      onMouseEnter={dismissFlyout}
    >
      <div className="flex justify-between items-center self-stretch w-full">
        <div className="flex grow basis-auto shrink gap-4 items-center">
          <SiteSwitcher />
          <hr className="w-px h-6 bg-surface-page" />
          <LanguageSwitcher />
          <hr className="w-px h-6 bg-surface-page" />
          <CurrencySwitcher />
          <CompanySwitcher />
        </div>
        {isAboveDesktopFlyoutBreakpoint && (
          <div className="justify-center items-center font-bold">
            <HeaderTopBannerAnnouncement />
          </div>
        )}
        <nav
          className="flex grow basis-auto shrink-0 pl-6 justify-end items-center gap-6 text-nowrap"
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
