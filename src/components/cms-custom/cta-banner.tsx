import Image from 'next/image';
import Link from 'next/link';
import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { Button } from '@/components/ui/button';
import { H2, Overline } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import {
  type SharedImage,
  type SharedLink,
  resolveImageSrc,
  sharedFieldDefinitions,
} from './_shared/field-definitions';
import { type Alignment, type Tone, alignClass, justifyClass, toneSurfaceClass } from './_shared/styles';

type Pattern = 'none' | 'gradient' | 'image';
type Height = 'sm' | 'md' | 'lg';

type CtaBannerProps = {
  eyebrow?: string;
  headline?: string;
  body?: string;
  primaryCta?: SharedLink;
  secondaryCta?: SharedLink;
  backgroundImage?: SharedImage;
  alignment?: Alignment;
  tone?: Tone;
  pattern?: Pattern;
  height?: Height;
};

const heightClass = (h?: Height) => (h === 'sm' ? 'min-h-[12rem]' : h === 'lg' ? 'min-h-[24rem]' : 'min-h-[16rem]');

export default function CtaBanner({
  eyebrow,
  headline,
  body,
  primaryCta,
  secondaryCta,
  backgroundImage,
  alignment = 'center',
  tone = 'accent',
  pattern = 'none',
  height = 'md',
}: CtaBannerProps) {
  const isInverted = tone === 'inverted' || tone === 'accent';
  const backgroundImageSrc = resolveImageSrc(backgroundImage);
  return (
    <section
      data-cms="cta-banner"
      data-tone={tone}
      data-pattern={pattern}
      className={cn('relative isolate w-full overflow-hidden', heightClass(height), toneSurfaceClass(tone))}
    >
      {pattern === 'image' && backgroundImageSrc ? (
        <>
          <Image
            src={backgroundImageSrc}
            alt={backgroundImage?.alt ?? ''}
            fill
            sizes="100vw"
            className="object-cover -z-20"
          />
          <span aria-hidden className="absolute inset-0 -z-10" style={{ background: 'var(--cms-overlay-dark)' }} />
        </>
      ) : null}
      {pattern === 'gradient' ? (
        <span
          aria-hidden
          className="absolute inset-0 -z-10 bg-linear-to-r from-gradient-primary-start to-gradient-primary-end"
        />
      ) : null}
      <div
        className={cn(
          'relative mx-auto flex max-w-5xl flex-col gap-4 px-6 py-12 md:px-12',
          alignClass(alignment),
          'm-auto',
          isInverted && 'text-text-on-action',
        )}
      >
        {eyebrow ? <Overline>{eyebrow}</Overline> : null}
        {headline ? <H2 className={cn(isInverted && 'text-text-on-action')}>{headline}</H2> : null}
        {body ? <p className="max-w-prose text-base">{body}</p> : null}
        {primaryCta?.url || secondaryCta?.url ? (
          <div className={cn('flex flex-wrap gap-3', justifyClass(alignment))}>
            {primaryCta?.url ? (
              <Button asChild variant="primary">
                <Link href={primaryCta.url} target={primaryCta.newTab ? '_blank' : undefined}>
                  {primaryCta.label ?? 'Learn more'}
                </Link>
              </Button>
            ) : null}
            {secondaryCta?.url ? (
              <Button asChild variant="secondary">
                <Link href={secondaryCta.url} target={secondaryCta.newTab ? '_blank' : undefined}>
                  {secondaryCta.label ?? 'See more'}
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export const ctaBannerEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-cta-banner',
    label: 'CTA banner',
    description: 'Full-width call-to-action banner with optional background image or gradient.',
    fieldDefinitions: sharedFieldDefinitions,
    props: {
      eyebrow: { label: 'Eyebrow', type: 'text' },
      headline: { label: 'Headline', type: 'text', required: true },
      body: { label: 'Body', type: 'textarea' },
      primary_cta: { $ref: 'link', label: 'Primary CTA', type: 'object' },
      secondary_cta: { $ref: 'link', label: 'Secondary CTA', type: 'object' },
      background_image: { $ref: 'image', label: 'Background image', type: 'object' },
      alignment: {
        label: 'Alignment',
        type: 'select',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
          { label: 'Right', value: 'right' },
        ],
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
      pattern: {
        label: 'Background',
        type: 'select',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Gradient', value: 'gradient' },
          { label: 'Image', value: 'image' },
        ],
      },
      height: {
        label: 'Height',
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
    },
    defaultProps: { alignment: 'center', tone: 'accent', pattern: 'none', height: 'md' },
  },
  mapProps: (p) => ({
    eyebrow: p.eyebrow,
    headline: p.headline,
    body: p.body,
    primaryCta: p.primary_cta,
    secondaryCta: p.secondary_cta,
    backgroundImage: p.background_image,
    alignment: p.alignment,
    tone: p.tone,
    pattern: p.pattern,
    height: p.height,
  }),
  component: CtaBanner,
};
