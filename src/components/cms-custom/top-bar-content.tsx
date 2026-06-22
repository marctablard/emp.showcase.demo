'use client';

import Link from 'next/link';
import { CurrencySwitcher } from '@/components/header/switcher/header-currency-switcher';
import { LanguageSwitcher } from '@/components/header/switcher/header-language-switcher';
import { SiteSwitcher } from '@/components/header/switcher/header-site-switcher';
import { cn } from '@/lib/utils';
import type { SharedLink } from './_shared/field-definitions';
import { type Tone, toneSurfaceClass } from './_shared/styles';

export type CmsTopBarProps = {
  tone?: Tone;
  showSiteSwitcher?: boolean;
  showLanguageSwitcher?: boolean;
  showCurrencySwitcher?: boolean;
  centerNavItems?: SharedLink[];
  rightNavItems?: SharedLink[];
};

const linkHref = (link?: SharedLink): string | undefined =>
  // Schema uses `href`; older payloads used `url`. Read both.
  (link as { href?: string; url?: string } | undefined)?.href ??
  (link as { href?: string; url?: string } | undefined)?.url;

function NavList({
  items,
  justify,
  pathPrefix,
}: {
  items: SharedLink[];
  justify: 'center' | 'end';
  pathPrefix: string;
}) {
  if (!items.length) return null;
  return (
    <nav
      className={cn(
        'hidden flex-1 items-center gap-6 text-nowrap md:flex',
        justify === 'center' ? 'justify-center' : 'justify-end',
      )}
    >
      {items.map((item, i) => {
        const href = linkHref(item);
        if (!href) return null;
        return (
          <Link key={i} href={href} target={item.newTab ? '_blank' : undefined} className="hover:underline">
            <span data-cms-field={`${pathPrefix}.${i}.label`}>{item.label ?? href}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function CmsTopBar({
  tone = 'accent',
  showSiteSwitcher = true,
  showLanguageSwitcher = true,
  showCurrencySwitcher = true,
  centerNavItems = [],
  rightNavItems = [],
}: CmsTopBarProps) {
  // Insert thin dividers only between visible switchers.
  const switchers = [
    showSiteSwitcher ? <SiteSwitcher key="site" /> : null,
    showLanguageSwitcher ? <LanguageSwitcher key="language" /> : null,
    showCurrencySwitcher ? <CurrencySwitcher key="currency" /> : null,
  ].filter(Boolean) as React.ReactNode[];

  return (
    <div data-cms="top-bar" data-tone={tone} className={cn('w-full text-sm', toneSurfaceClass(tone))}>
      <div className="flex w-full items-center gap-4 px-6 py-2 md:px-12">
        <div className="flex flex-1 items-center gap-4">
          {switchers.map((node, i) => (
            <div key={i} className="flex items-center gap-4">
              {node}
              {i < switchers.length - 1 ? <span aria-hidden className="h-5 w-px bg-current/30" /> : null}
            </div>
          ))}
        </div>
        <NavList items={centerNavItems} justify="center" pathPrefix="center_nav_items" />
        <NavList items={rightNavItems} justify="end" pathPrefix="right_nav_items" />
      </div>
    </div>
  );
}
