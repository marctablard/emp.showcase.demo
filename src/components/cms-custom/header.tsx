import Image from 'next/image';
import Link from 'next/link';
import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { cn } from '@/lib/utils';
import {
  type SharedImage,
  type SharedLink,
  normalizeMedia,
  resolveImageSrc,
  sharedFieldDefinitions,
} from './_shared/field-definitions';
import { type Tone, toneSurfaceClass } from './_shared/styles';

type CmsHeaderProps = {
  logo?: SharedImage;
  logoText?: string;
  navItems?: SharedLink[];
  cta?: SharedLink;
  sticky?: boolean;
  tone?: Tone;
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
}: CmsHeaderProps) {
  const logoSrc = resolveImageSrc(logo);
  const ctaHref = linkHref(cta);
  return (
    <header
      data-cms="header"
      data-tone={tone}
      className={cn('w-full border-b border-border-primary', toneSurfaceClass(tone), sticky && 'sticky top-0 z-40')}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-4 md:px-12">
        <Link href="/" className="flex items-center gap-3">
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
          {ctaHref ? (
            <Link
              href={ctaHref}
              target={cta?.newTab ? '_blank' : undefined}
              className="rounded-button bg-surface-action px-4 py-2 text-text-on-action transition-colors hover:bg-surface-action-hover"
            >
              {cta?.label ?? 'Get started'}
            </Link>
          ) : null}
        </nav>

        <details className="relative md:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-center p-2 [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden
              className="block h-0.5 w-6 bg-current shadow-[0_-6px_0_currentColor,0_6px_0_currentColor]"
            />
            <span className="sr-only">Toggle navigation</span>
          </summary>
          <nav className="absolute right-0 top-full z-50 mt-2 flex min-w-48 flex-col gap-2 rounded-md border border-border-primary bg-surface-page p-4 shadow-lg">
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
          </nav>
        </details>
      </div>
    </header>
  );
}

export const cmsHeaderEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-header',
    label: 'Header',
    description: 'Site header with logo, navigation links, and an optional CTA.',
    fieldDefinitions: sharedFieldDefinitions,
    props: {
      logo: { label: 'Logo image', type: 'media', allowedTypes: ['image/*'] },
      logo_text: { label: 'Logo text', type: 'text' },
      nav_items: {
        label: 'Navigation items',
        type: 'array',
        items: { $ref: 'link', label: 'Link', type: 'object' },
      },
      cta: { $ref: 'link', label: 'CTA button', type: 'object' },
      sticky: { label: 'Sticky on scroll', type: 'boolean' },
      tone: {
        label: 'Tone',
        type: 'select',
        options: [
          { label: 'Default', value: 'default' },
          { label: 'Muted', value: 'muted' },
          { label: 'Accent', value: 'accent' },
          { label: 'Inverted', value: 'inverted' },
        ],
      },
    },
    defaultProps: { sticky: false, tone: 'default' },
  },
  mapProps: (p) => ({
    logo: normalizeMedia(p.logo),
    logoText: p.logo_text,
    navItems: p.nav_items ?? [],
    cta: p.cta,
    sticky: p.sticky,
    tone: p.tone,
  }),
  component: CmsHeader,
};
