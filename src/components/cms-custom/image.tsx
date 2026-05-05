import Image from 'next/image';
import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { cn } from '@/lib/utils';
import { type SharedImage, resolveImageSrc, sharedFieldDefinitions } from './_shared/field-definitions';
import { type MaxWidth, type Radius, maxWidthClass, radiusClass } from './_shared/styles';

type Aspect = 'auto' | 'square' | 'video' | 'wide' | 'portrait';
type Fit = 'cover' | 'contain';

type ImageBlockProps = {
  image?: SharedImage;
  caption?: string;
  aspect?: Aspect;
  radius?: Radius;
  fit?: Fit;
  maxWidth?: MaxWidth;
};

const aspectClass = (aspect?: Aspect) => {
  switch (aspect) {
    case 'square':
      return 'aspect-square';
    case 'video':
      return 'aspect-video';
    case 'wide':
      return 'aspect-[21/9]';
    case 'portrait':
      return 'aspect-[3/4]';
    case 'auto':
    default:
      return 'aspect-[16/9]';
  }
};

export default function ImageBlock({
  image,
  caption,
  aspect = 'auto',
  radius = 'md',
  fit = 'cover',
  maxWidth = 'content',
}: ImageBlockProps) {
  const imageSrc = resolveImageSrc(image);
  if (!imageSrc) return null;
  return (
    <figure data-cms="image" className={cn('flex flex-col gap-2 px-6 md:px-12', maxWidthClass(maxWidth))}>
      <div
        className={cn(
          'relative w-full overflow-hidden bg-surface-image-background',
          aspectClass(aspect),
          radiusClass(radius),
        )}
      >
        <Image
          src={imageSrc}
          alt={image?.alt ?? ''}
          fill
          sizes="(max-width: 768px) 100vw, 1024px"
          className={fit === 'contain' ? 'object-contain' : 'object-cover'}
        />
      </div>
      {caption ? <figcaption className="text-sm text-text-placeholders">{caption}</figcaption> : null}
    </figure>
  );
}

export const imageEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-image',
    label: 'Image',
    description: 'Standalone image with optional caption and aspect ratio.',
    fieldDefinitions: sharedFieldDefinitions,
    props: {
      image: { $ref: 'image', label: 'Image', type: 'media', allowedTypes: ['image/*'], required: true },
      caption: { label: 'Caption', type: 'text' },
      aspect: {
        label: 'Aspect ratio',
        type: 'select',
        options: [
          { label: 'Auto (16:9)', value: 'auto' },
          { label: 'Square', value: 'square' },
          { label: 'Video (16:9)', value: 'video' },
          { label: 'Wide (21:9)', value: 'wide' },
          { label: 'Portrait (3:4)', value: 'portrait' },
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
          { label: 'Full', value: 'full' },
        ],
      },
      fit: {
        label: 'Fit',
        type: 'select',
        options: [
          { label: 'Cover', value: 'cover' },
          { label: 'Contain', value: 'contain' },
        ],
      },
      max_width: {
        label: 'Max width',
        type: 'select',
        options: [
          { label: 'Narrow', value: 'narrow' },
          { label: 'Content', value: 'content' },
          { label: 'Wide', value: 'wide' },
          { label: 'Full', value: 'full' },
        ],
      },
    },
    defaultProps: { aspect: 'auto', radius: 'md', fit: 'cover', max_width: 'content' },
  },
  mapProps: (p) => ({
    image: p.image,
    caption: p.caption,
    aspect: p.aspect,
    radius: p.radius,
    fit: p.fit,
    maxWidth: p.max_width,
  }),
  component: ImageBlock,
};
