import Image from 'next/image';
import Link from 'next/link';
import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { Facebook, Instagram, Linkedin, type LucideIcon, Twitter, Youtube } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type SharedImage,
  type SharedLink,
  normalizeMedia,
  resolveImageSrc,
  sharedFieldDefinitions,
} from './_shared/field-definitions';
import { type Tone, toneSurfaceClass } from './_shared/styles';

type FooterColumn = {
  heading?: string;
  links?: SharedLink[];
};

type SocialPlatform = 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'youtube';

type SocialLink = {
  platform?: SocialPlatform;
  href?: string;
  url?: string;
};

type CmsFooterProps = {
  logo?: SharedImage;
  tagline?: string;
  columns?: FooterColumn[];
  socialLinks?: SocialLink[];
  bottomText?: string;
  bottomLinks?: SharedLink[];
  tone?: Tone;
};

const linkHref = (link?: SharedLink): string | undefined =>
  (link as { href?: string; url?: string } | undefined)?.href ??
  (link as { href?: string; url?: string } | undefined)?.url;

const socialIconMap: Record<SocialPlatform, LucideIcon> = {
  twitter: Twitter,
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
};

export default function CmsFooter({
  logo,
  tagline,
  columns = [],
  socialLinks = [],
  bottomText,
  bottomLinks = [],
  tone = 'inverted',
}: CmsFooterProps) {
  const logoSrc = resolveImageSrc(logo);
  const hasTopRow = Boolean(logoSrc || tagline) || columns.length > 0;
  const hasBottomRow = Boolean(bottomText) || bottomLinks.length > 0 || socialLinks.length > 0;

  return (
    <footer data-cms="footer" data-tone={tone} className={cn('w-full', toneSurfaceClass(tone))}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 py-12 md:px-12">
        {hasTopRow ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_2fr] md:gap-12">
            <div className="flex flex-col gap-3">
              {logoSrc ? (
                <span data-cms-field="logo" className="relative h-12 w-32">
                  <Image
                    src={logoSrc}
                    alt={logo?.alt ?? ''}
                    fill
                    sizes="128px"
                    className="object-contain object-left"
                  />
                </span>
              ) : null}
              {tagline ? (
                <p data-cms-field="tagline" className="max-w-prose whitespace-pre-line text-base">
                  {tagline}
                </p>
              ) : null}
            </div>
            {columns.length > 0 ? (
              <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12">
                {columns.map((col, i) => (
                  <div key={i} className="flex flex-col gap-3">
                    {col.heading ? (
                      <span
                        data-cms-field={`columns.${i}.heading`}
                        className="text-sm font-semibold uppercase tracking-widest opacity-80"
                      >
                        {col.heading}
                      </span>
                    ) : null}
                    <ul className="flex flex-col gap-2">
                      {(col.links ?? []).map((link, j) => {
                        const href = linkHref(link);
                        if (!href) return null;
                        return (
                          <li key={j}>
                            <Link
                              href={href}
                              target={link.newTab ? '_blank' : undefined}
                              className="text-base hover:opacity-80"
                            >
                              <span data-cms-field={`columns.${i}.links.${j}.label`}>{link.label ?? href}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {hasBottomRow ? (
          <div
            className={cn(
              'flex flex-col items-start justify-between gap-4 pt-6 md:flex-row md:items-center',
              hasTopRow && 'border-t border-current/20',
            )}
          >
            {bottomText ? (
              <span data-cms-field="bottom_text" className="text-sm opacity-80">
                {bottomText}
              </span>
            ) : (
              <span />
            )}

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {bottomLinks.map((link, i) => {
                const href = linkHref(link);
                if (!href) return null;
                return (
                  <Link
                    key={i}
                    href={href}
                    target={link.newTab ? '_blank' : undefined}
                    className="text-sm hover:opacity-80"
                  >
                    <span data-cms-field={`bottom_links.${i}.label`}>{link.label ?? href}</span>
                  </Link>
                );
              })}
              {socialLinks.length > 0 ? (
                <div className="flex items-center gap-3">
                  {socialLinks.map((s, i) => {
                    const href = s.href ?? s.url;
                    if (!href || !s.platform) return null;
                    const Icon = socialIconMap[s.platform];
                    return (
                      <a
                        key={i}
                        data-cms-field={`social_links.${i}.href`}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={s.platform}
                        className="hover:opacity-80"
                      >
                        <Icon size={20} />
                      </a>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </footer>
  );
}

export const cmsFooterEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-footer',
    label: 'Footer',
    description: 'Site footer with link columns, optional logo/tagline, social links, and a bottom row.',
    fieldDefinitions: sharedFieldDefinitions,
    props: {
      logo: { label: 'Logo', type: 'media', allowedTypes: ['image/*'] },
      tagline: { label: 'Tagline', type: 'textarea' },
      columns: {
        label: 'Link columns',
        type: 'array',
        items: {
          label: 'Column',
          type: 'object',
          properties: {
            heading: { label: 'Heading', type: 'text' },
            links: {
              label: 'Links',
              type: 'array',
              items: { $ref: 'link', label: 'Link', type: 'object' },
            },
          },
        },
      },
      social_links: {
        label: 'Social links',
        type: 'array',
        items: {
          label: 'Social link',
          type: 'object',
          properties: {
            platform: {
              label: 'Platform',
              type: 'select',
              options: [
                { label: 'Twitter / X', value: 'twitter' },
                { label: 'Facebook', value: 'facebook' },
                { label: 'Instagram', value: 'instagram' },
                { label: 'LinkedIn', value: 'linkedin' },
                { label: 'YouTube', value: 'youtube' },
              ],
            },
            href: { label: 'URL', type: 'url', required: true },
          },
        },
      },
      bottom_text: { label: 'Bottom text (e.g. copyright)', type: 'text' },
      bottom_links: {
        label: 'Bottom links (legal)',
        type: 'array',
        items: { $ref: 'link', label: 'Link', type: 'object' },
      },
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
    defaultProps: { tone: 'inverted' },
  },
  mapProps: (p) => ({
    logo: normalizeMedia(p.logo),
    tagline: p.tagline,
    columns: p.columns ?? [],
    socialLinks: p.social_links ?? [],
    bottomText: p.bottom_text,
    bottomLinks: p.bottom_links ?? [],
    tone: p.tone,
  }),
  component: CmsFooter,
};
