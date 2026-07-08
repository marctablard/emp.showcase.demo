import Image from 'next/image';
import Link from 'next/link';
import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { Button } from '@/components/ui/button';
import { H1, Overline } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import {
  type SharedImage,
  type SharedLink,
  linkHref,
  resolveImageSrc,
  sharedFieldDefinitions,
} from './_shared/field-definitions';
import { type Alignment, type Tone, alignClass, justifyClass } from './_shared/styles';

type Height = 'auto' | 'sm' | 'md' | 'lg' | 'fullscreen';
type Overlay = 'none' | 'light' | 'dark';
type ContentBox = 'none' | 'light' | 'dark';

type HeroBannerProps = {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  image?: SharedImage;
  primaryCta?: SharedLink;
  secondaryCta?: SharedLink;
  alignment?: Alignment;
  height?: Height;
  overlay?: Overlay;
  tone?: Exclude<Tone, 'muted'>;
  contentBox?: ContentBox;
};

const heightClass = (height?: Height) => {
  switch (height) {
    case 'sm':
      return 'min-h-[20rem]';
    case 'md':
      return 'min-h-[28rem]';
    case 'lg':
      return 'min-h-[36rem]';
    case 'fullscreen':
      return 'min-h-[calc(100vh-4rem)]';
    default:
      return 'min-h-[24rem]';
  }
};

export default function HeroBanner({
  eyebrow,
  headline,
  subheadline,
  image,
  primaryCta,
  secondaryCta,
  alignment = 'left',
  height = 'md',
  overlay = 'none',
  tone = 'default',
  contentBox = 'none',
}: HeroBannerProps) {
  const isInverted = tone === 'inverted';
  // When a content box is present, its own background drives the text color
  // (dark text on light box, light text on dark box) — overriding tone.
  const effectiveInverted = contentBox === 'dark' || (contentBox === 'none' && isInverted);
  const imageSrc = resolveImageSrc(image);
  const primaryHref = linkHref(primaryCta);
  const secondaryHref = linkHref(secondaryCta);
  return (
    <section
      data-cms="hero-banner"
      data-tone={tone}
      data-overlay={overlay}
      className={cn(
        'relative isolate flex w-full overflow-hidden',
        heightClass(height),
        isInverted ? 'text-text-on-action' : 'text-text-body',
      )}
    >
      {imageSrc ? (
        <Image
          data-cms-field="image"
          src={imageSrc}
          alt={image?.alt ?? ''}
          fill
          priority
          sizes="100vw"
          className="object-cover -z-20"
        />
      ) : null}
      {overlay !== 'none' ? (
        <span
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background: overlay === 'light' ? 'var(--cms-overlay-light)' : 'var(--cms-overlay-dark)',
          }}
        />
      ) : null}
      <div
        className={cn(
          'relative flex w-full px-6 py-12 md:px-12',
          alignClass(alignment),
          justifyClass(alignment),
          'm-auto max-w-6xl',
        )}
      >
        <div
          className={cn(
            'flex flex-col gap-6',
            alignClass(alignment),
            contentBox !== 'none' && 'max-w-2xl rounded-lg p-6 backdrop-blur-sm md:p-8',
            contentBox === 'light' && 'text-text-body',
            contentBox === 'dark' && 'text-text-on-action',
          )}
          style={
            contentBox === 'light'
              ? { background: 'oklch(1 0 0 / 0.85)' }
              : contentBox === 'dark'
                ? { background: 'oklch(0.2 0 0 / 0.65)' }
                : undefined
          }
        >
          {eyebrow ? (
            <Overline className={effectiveInverted ? 'text-text-on-action' : undefined}>{eyebrow}</Overline>
          ) : null}
          {headline ? <H1 className={cn(effectiveInverted && 'text-text-on-action')}>{headline}</H1> : null}
          {subheadline ? (
            <p className={cn('max-w-2xl text-lg', effectiveInverted && 'text-text-on-action')}>{subheadline}</p>
          ) : null}
          {primaryHref || secondaryHref ? (
            <div className={cn('flex flex-wrap gap-3', justifyClass(alignment))}>
              {primaryHref ? (
                <Button asChild variant="primary">
                  <Link href={primaryHref} target={primaryCta?.newTab ? '_blank' : undefined}>
                    <span data-cms-field="primary_cta.label">{primaryCta?.label ?? 'Learn more'}</span>
                  </Link>
                </Button>
              ) : null}
              {secondaryHref ? (
                <Button
                  asChild
                  variant="secondary"
                  className={cn(
                    effectiveInverted &&
                      'border-current bg-[oklch(1_0_0/0.1)] text-text-on-action hover:border-current hover:bg-[oklch(1_0_0/0.2)] hover:text-text-on-action',
                  )}
                >
                  <Link href={secondaryHref} target={secondaryCta?.newTab ? '_blank' : undefined}>
                    <span data-cms-field="secondary_cta.label">{secondaryCta?.label ?? 'See more'}</span>
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export const heroBannerEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-hero-banner',
    label: 'Hero Banner',
    description: 'Full-width hero with eyebrow, headline, subheadline, image and up to two CTAs.',
    fieldDefinitions: sharedFieldDefinitions,
    props: {
      eyebrow: { label: 'Eyebrow', type: 'text' },
      headline: { label: 'Headline', type: 'text', required: true },
      subheadline: { label: 'Subheadline', type: 'textarea' },
      image: { $ref: 'image', label: 'Background Image', type: 'media', allowedTypes: ['image/*'], required: true },
      primary_cta: { $ref: 'link', label: 'Primary CTA', type: 'object' },
      secondary_cta: { $ref: 'link', label: 'Secondary CTA', type: 'object' },
      alignment: {
        label: 'Alignment',
        type: 'select',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
          { label: 'Right', value: 'right' },
        ],
      },
      height: {
        label: 'Height',
        type: 'select',
        options: [
          { label: 'Auto', value: 'auto' },
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
          { label: 'Fullscreen', value: 'fullscreen' },
        ],
      },
      overlay: {
        label: 'Overlay',
        type: 'select',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Light', value: 'light' },
          { label: 'Dark', value: 'dark' },
        ],
      },
      tone: {
        label: 'Tone',
        type: 'select',
        options: [
          { label: 'Default', value: 'default' },
          { label: 'Inverted', value: 'inverted' },
        ],
      },
      content_box: {
        label: 'Content box',
        type: 'select',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Light', value: 'light' },
          { label: 'Dark', value: 'dark' },
        ],
      },
    },
    defaultProps: {
      headline: 'Welcome',
      alignment: 'left',
      height: 'md',
      overlay: 'none',
      tone: 'default',
      content_box: 'none',
    },
  },
  mapProps: (p) => ({
    eyebrow: p.eyebrow,
    headline: p.headline,
    subheadline: p.subheadline,
    image: p.image,
    primaryCta: p.primary_cta,
    secondaryCta: p.secondary_cta,
    alignment: p.alignment,
    height: p.height,
    overlay: p.overlay,
    tone: p.tone,
    contentBox: p.content_box,
  }),
  component: HeroBanner,
};
