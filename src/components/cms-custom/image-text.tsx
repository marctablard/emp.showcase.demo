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
import { type Tone, toneSurfaceClass } from './_shared/styles';

type ImagePosition = 'left' | 'right';
type ImageWidth = 'sm' | 'md' | 'lg';
type VerticalAlign = 'top' | 'center' | 'bottom';

type ImageTextProps = {
  image?: SharedImage;
  eyebrow?: string;
  headline?: string;
  body?: string;
  cta?: SharedLink;
  imagePosition?: ImagePosition;
  imageWidth?: ImageWidth;
  verticalAlign?: VerticalAlign;
  tone?: Tone;
};

const widthClass = (w?: ImageWidth) => {
  switch (w) {
    case 'sm':
      return 'md:w-1/3';
    case 'lg':
      return 'md:w-2/3';
    case 'md':
    default:
      return 'md:w-1/2';
  }
};

const alignClass = (v?: VerticalAlign) => {
  switch (v) {
    case 'top':
      return 'md:items-start';
    case 'bottom':
      return 'md:items-end';
    case 'center':
    default:
      return 'md:items-center';
  }
};

export default function ImageText({
  image,
  eyebrow,
  headline,
  body,
  cta,
  imagePosition = 'left',
  imageWidth = 'md',
  verticalAlign = 'center',
  tone = 'default',
}: ImageTextProps) {
  const imageSrc = resolveImageSrc(image);
  const imageEl = imageSrc ? (
    <div
      className={cn(
        'relative aspect-[4/3] w-full overflow-hidden rounded-md bg-surface-image-background',
        widthClass(imageWidth),
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
  ) : null;
  const textEl = (
    <div className="flex flex-1 flex-col gap-4">
      {eyebrow ? <Overline>{eyebrow}</Overline> : null}
      {headline ? <H3>{headline}</H3> : null}
      {body ? <p className="whitespace-pre-line text-base text-text-body">{body}</p> : null}
      {cta?.url ? (
        <div>
          <Button asChild variant="primary">
            <Link href={cta.url} target={cta.newTab ? '_blank' : undefined}>
              {cta.label ?? 'Learn more'}
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
  return (
    <section
      data-cms="image-text"
      data-tone={tone}
      data-image-position={imagePosition}
      className={cn('w-full', toneSurfaceClass(tone))}
    >
      <div
        className={cn(
          'mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 md:flex-row md:px-12',
          alignClass(verticalAlign),
          imagePosition === 'right' && 'md:flex-row-reverse',
        )}
      >
        {imageEl}
        {textEl}
      </div>
    </section>
  );
}

export const imageTextEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-image-text',
    label: 'Image + text',
    description: 'Side-by-side image and text block.',
    fieldDefinitions: sharedFieldDefinitions,
    props: {
      image: { $ref: 'image', label: 'Image', type: 'object', required: true },
      eyebrow: { label: 'Eyebrow', type: 'text' },
      headline: { label: 'Headline', type: 'text' },
      body: { label: 'Body', type: 'textarea' },
      cta: { $ref: 'link', label: 'CTA', type: 'object' },
      image_position: {
        label: 'Image position',
        type: 'select',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
      },
      image_width: {
        label: 'Image width',
        type: 'select',
        options: [
          { label: 'Small (1/3)', value: 'sm' },
          { label: 'Medium (1/2)', value: 'md' },
          { label: 'Large (2/3)', value: 'lg' },
        ],
      },
      vertical_align: {
        label: 'Vertical align',
        type: 'select',
        options: [
          { label: 'Top', value: 'top' },
          { label: 'Center', value: 'center' },
          { label: 'Bottom', value: 'bottom' },
        ],
      },
      tone: {
        label: 'Tone',
        type: 'select',
        options: [
          { label: 'Default', value: 'default' },
          { label: 'Muted', value: 'muted' },
          { label: 'Accent', value: 'accent' },
        ],
      },
    },
    defaultProps: {
      image_position: 'left',
      image_width: 'md',
      vertical_align: 'center',
      tone: 'default',
    },
  },
  mapProps: (p) => ({
    image: p.image,
    eyebrow: p.eyebrow,
    headline: p.headline,
    body: p.body,
    cta: p.cta,
    imagePosition: p.image_position,
    imageWidth: p.image_width,
    verticalAlign: p.vertical_align,
    tone: p.tone,
  }),
  component: ImageText,
};
