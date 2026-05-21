import type { CMSPropDefinition } from '@extensions/medienwerft-cms-plugin/types';

export const sharedFieldDefinitions: Record<string, CMSPropDefinition> = {
  image: {
    label: 'Image',
    type: 'object' as const,
    properties: {
      filename: { label: 'Image URL', type: 'text' as const, required: true },
      alt: { label: 'Alt Text', type: 'text' as const },
    },
  },
  link: {
    label: 'Link',
    type: 'object' as const,
    properties: {
      label: { label: 'Label', type: 'text' as const, required: true },
      href: { label: 'URL', type: 'url' as const, required: true },
    },
  },
};

export type SharedImage = { filename?: string; alt?: string; url?: string };
// Schema stores `href`; legacy payloads used `url`. Components must accept either.
export type SharedLink = { href?: string; url?: string; label?: string; newTab?: boolean };

export const linkHref = (link?: SharedLink | null): string | undefined => link?.href ?? link?.url;

const tryAsImageSrc = (value: string | undefined | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return undefined;
};

/**
 * Returns a usable `next/image` src for a `SharedImage`. Prefers the editor-
 * supplied `url` (real CDN URL set by the media picker) and falls back to
 * `filename` only if it happens to be a valid URL/path. Returns `undefined`
 * when neither is usable — callers must fall through to a no-image branch
 * to avoid the `Failed to parse src` runtime crash.
 */
export const resolveImageSrc = (image: SharedImage | undefined | null): string | undefined => {
  if (!image) return undefined;
  return tryAsImageSrc(image.url) ?? tryAsImageSrc(image.filename);
};

/**
 * Normalizes whatever the editor returns for a `type: 'media'` field into a
 * `SharedImage` object so downstream code can treat all image-bearing props
 * the same way. Some editors return a bare URL string; others return the
 * familiar `{ filename, alt, url }` object. This helper accepts either.
 */
export const normalizeMedia = (value: unknown): SharedImage | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return { url: value };
  if (typeof value === 'object') return value as SharedImage;
  return undefined;
};
