import Image from 'next/image';
import Link from 'next/link';
import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { Button } from '@/components/ui/button';
import { H3, Overline } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import {
  type SharedImage,
  type SharedLink,
  resolveImageSrc,
  sharedFieldDefinitions,
} from './_shared/field-definitions';
import { type Density, type Radius, type Tone, densityClass, radiusClass, toneSurfaceClass } from './_shared/styles';

type ImagePosition = 'top' | 'left' | 'right' | 'background';

type PromoCardProps = {
  eyebrow?: string;
  headline?: string;
  body?: string;
  image?: SharedImage;
  cta?: SharedLink;
  imagePosition?: ImagePosition;
  tone?: Tone;
  radius?: Radius;
  padding?: Density;
};

export default function PromoCard({
  eyebrow,
  headline,
  body,
  image,
  cta,
  imagePosition = 'top',
  tone = 'default',
  radius = 'lg',
  padding = 'comfortable',
}: PromoCardProps) {
  const isInverted = tone === 'accent' || tone === 'inverted' || imagePosition === 'background';
  const imageSrc = resolveImageSrc(image);
  const Inner = (
    <div className="flex flex-col gap-3">
      {eyebrow ? <Overline>{eyebrow}</Overline> : null}
      {headline ? <H3 className={cn(isInverted && 'text-text-on-action')}>{headline}</H3> : null}
      {body ? <p className={cn('text-base', isInverted && 'text-text-on-action')}>{body}</p> : null}
      {cta?.url ? (
        <div>
          <Button asChild variant={isInverted ? 'secondary' : 'primary'}>
            <Link href={cta.url} target={cta.newTab ? '_blank' : undefined}>
              {cta.label ?? 'Learn more'}
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );

  if (imagePosition === 'background') {
    return (
      <section
        data-cms="promo-card"
        data-tone={tone}
        data-image-position="background"
        className={cn(
          'relative isolate mx-auto w-full max-w-5xl overflow-hidden text-text-on-action',
          radiusClass(radius),
          densityClass(padding),
        )}
      >
        {imageSrc ? (
          <>
            <Image
              src={imageSrc}
              alt={image?.alt ?? ''}
              fill
              sizes="(max-width: 768px) 100vw, 1024px"
              className="-z-20 object-cover"
            />
            <span aria-hidden className="absolute inset-0 -z-10" style={{ background: 'var(--cms-overlay-dark)' }} />
          </>
        ) : null}
        <div className="relative px-6 md:px-12">{Inner}</div>
      </section>
    );
  }

  return (
    <section
      data-cms="promo-card"
      data-tone={tone}
      data-image-position={imagePosition}
      className={cn('mx-auto w-full max-w-5xl overflow-hidden', toneSurfaceClass(tone), radiusClass(radius))}
    >
      <div
        className={cn(
          'flex flex-col gap-6 p-6 md:p-10',
          imagePosition === 'left' && 'md:flex-row md:items-center',
          imagePosition === 'right' && 'md:flex-row-reverse md:items-center',
        )}
      >
        {imageSrc ? (
          <div
            className={cn(
              'relative w-full overflow-hidden rounded-md bg-surface-image-background',
              imagePosition === 'top' ? 'aspect-[16/9]' : 'aspect-square md:w-1/2',
            )}
          >
            <Image
              src={imageSrc}
              alt={image?.alt ?? ''}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        ) : null}
        {Inner}
      </div>
    </section>
  );
}

export const promoCardEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-promo-card',
    label: 'Promo card',
    description: 'A single promotional card with image, headline, body, and CTA.',
    fieldDefinitions: sharedFieldDefinitions,
    props: {
      eyebrow: { label: 'Eyebrow', type: 'text' },
      headline: { label: 'Headline', type: 'text', required: true },
      body: { label: 'Body', type: 'textarea' },
      image: { $ref: 'image', label: 'Image', type: 'media', allowedTypes: ['image/*'] },
      cta: { $ref: 'link', label: 'CTA', type: 'object' },
      image_position: {
        label: 'Image position',
        type: 'select',
        options: [
          { label: 'Top', value: 'top' },
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
          { label: 'Background', value: 'background' },
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
      radius: {
        label: 'Corner radius',
        type: 'select',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      padding: {
        label: 'Padding',
        type: 'select',
        options: [
          { label: 'Compact', value: 'compact' },
          { label: 'Comfortable', value: 'comfortable' },
          { label: 'Spacious', value: 'spacious' },
        ],
      },
    },
    defaultProps: { image_position: 'top', tone: 'default', radius: 'lg', padding: 'comfortable' },
  },
  mapProps: (p) => ({
    eyebrow: p.eyebrow,
    headline: p.headline,
    body: p.body,
    image: p.image,
    cta: p.cta,
    imagePosition: p.image_position,
    tone: p.tone,
    radius: p.radius,
    padding: p.padding,
  }),
  component: PromoCard,
};
