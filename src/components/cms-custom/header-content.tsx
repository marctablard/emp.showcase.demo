'use client';

import Image from 'next/image';
import Link from 'next/link';
import { HeaderCartButton } from '@/components/header/cart/header-cart-button';
import { LanguageSwitcher } from '@/components/header/switcher/header-language-switcher';
import { cn } from '@/lib/utils';
import { type SharedImage, type SharedLink, resolveImageSrc } from './_shared/field-definitions';
import { type Tone, toneSurfaceClass } from './_shared/styles';
import { CmsAccountButton } from './cms-account-button';
import { CmsSearch } from './cms-search';

export type CmsHeaderProps = {
  logo?: SharedImage;
  logoText?: string;
  navItems?: SharedLink[];
  cta?: SharedLink;
  sticky?: boolean;
  tone?: Tone;
  showSearch?: boolean;
  showAccount?: boolean;
  showCart?: boolean;
  showLanguageSwitcher?: boolean;
};

const linkHref = (link?: SharedLink): string | undefined =>
  // Schema uses `href`; older payloads used `url`. Read both.
  (link as { href?: string; url?: string } | undefined)?.href ??
  (link as { href?: string; url?: string } | undefined)?.url;

export default function CmsHeader({
  logo,
  logoText,
  navItems = [],
  cta,
  sticky = false,
  tone = 'default',
  showSearch = true,
  showAccount = true,
  showCart = true,
  showLanguageSwitcher = true,
}: CmsHeaderProps) {
  const logoSrc = resolveImageSrc(logo);
  const ctaHref = linkHref(cta);
  return (
    <header
      data-cms="header"
      data-tone={tone}
      className={cn(
        // `relative` is the offset parent for CmsSearch's flyout — keep it.
        'relative w-full border-b border-border-primary z-40',
        toneSurfaceClass(tone),
        sticky && 'sticky top-0',
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-6 px-6 py-4 md:px-12">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          {logoSrc ? (
            <span className="relative h-10 w-32 shrink-0">
              <Image
                src={logoSrc}
                alt={logo?.alt ?? logoText ?? 'Home'}
                fill
                sizes="128px"
                className="object-contain object-left"
              />
            </span>
          ) : null}
          {logoText ? <span className="font-headlines text-xl">{logoText}</span> : null}
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item, i) => {
            const href = linkHref(item);
            if (!href) return null;
            return (
              <Link
                key={i}
                href={href}
                target={item.newTab ? '_blank' : undefined}
                className="text-base text-text-body transition-colors hover:text-text-action"
              >
                {item.label ?? href}
              </Link>
            );
          })}
        </nav>

        {showSearch ? (
          <div className="ml-auto hidden flex-1 md:block">
            <CmsSearch />
          </div>
        ) : (
          <div className="ml-auto" />
        )}

        <div className="hidden items-center gap-4 md:flex">
          {ctaHref ? (
            <Link
              href={ctaHref}
              target={cta?.newTab ? '_blank' : undefined}
              className="rounded-button bg-surface-action px-4 py-2 text-text-on-action transition-colors hover:bg-surface-action-hover"
            >
              {cta?.label ?? 'Get started'}
            </Link>
          ) : null}
          {showLanguageSwitcher ? <LanguageSwitcher /> : null}
          {showAccount ? <CmsAccountButton /> : null}
          {showCart ? <HeaderCartButton showSum={false} /> : null}
        </div>

        <details className="relative ml-auto md:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-center p-2 [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden
              className="block h-0.5 w-6 bg-current shadow-[0_-6px_0_currentColor,0_6px_0_currentColor]"
            />
            <span className="sr-only">Toggle navigation</span>
          </summary>
          <nav className="absolute right-0 top-full z-50 mt-2 flex min-w-56 flex-col gap-2 rounded-md border border-border-primary bg-surface-page p-4 shadow-lg">
            {navItems.map((item, i) => {
              const href = linkHref(item);
              if (!href) return null;
              return (
                <Link
                  key={i}
                  href={href}
                  target={item.newTab ? '_blank' : undefined}
                  className="text-base text-text-body hover:text-text-action"
                >
                  {item.label ?? href}
                </Link>
              );
            })}
            {ctaHref ? (
              <Link
                href={ctaHref}
                target={cta?.newTab ? '_blank' : undefined}
                className="mt-2 rounded-button bg-surface-action px-4 py-2 text-center text-text-on-action"
              >
                {cta?.label ?? 'Get started'}
              </Link>
            ) : null}
            {(showAccount || showCart || showLanguageSwitcher) && (
              <div className="mt-2 flex items-center justify-around gap-2 border-t border-border-primary pt-3">
                {showLanguageSwitcher ? <LanguageSwitcher /> : null}
                {showAccount ? <CmsAccountButton /> : null}
                {showCart ? <HeaderCartButton showSum={false} /> : null}
              </div>
            )}
          </nav>
        </details>
      </div>
    </header>
  );
}
