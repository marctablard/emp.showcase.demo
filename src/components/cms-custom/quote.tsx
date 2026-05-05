import Image from 'next/image';
import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
import { cn } from '@/lib/utils';
import { type SharedImage, resolveImageSrc, sharedFieldDefinitions } from './_shared/field-definitions';
import { type Alignment, alignClass } from './_shared/styles';

type QuoteStyle = 'plain' | 'card' | 'bordered';
type Tone = 'default' | 'accent';

type QuoteProps = {
  quote?: string;
  author?: string;
  authorRole?: string;
  authorImage?: SharedImage;
  alignment?: Alignment;
  tone?: Tone;
  style?: QuoteStyle;
};

const styleClass = (s?: QuoteStyle) => {
  switch (s) {
    case 'card':
      return 'bg-surface-secondary rounded-lg p-8 shadow-sm';
    case 'bordered':
      return 'border-l-4 border-border-action pl-6';
    case 'plain':
    default:
      return '';
  }
};

const toneClass = (t?: Tone) => (t === 'accent' ? 'text-text-action' : 'text-text-headings');

export default function Quote({
  quote,
  author,
  authorRole,
  authorImage,
  alignment = 'left',
  tone = 'default',
  style = 'plain',
}: QuoteProps) {
  if (!quote) return null;
  const authorImageSrc = resolveImageSrc(authorImage);
  return (
    <figure
      data-cms="quote"
      data-style={style}
      className={cn(
        'mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 md:px-12',
        alignClass(alignment),
        styleClass(style),
      )}
    >
      <blockquote className={cn('text-2xl leading-relaxed font-headlines', toneClass(tone))}>“{quote}”</blockquote>
      <figcaption className="flex items-center gap-3">
        {authorImageSrc ? (
          <span className="relative h-10 w-10 overflow-hidden rounded-full bg-surface-image-background">
            <Image
              src={authorImageSrc}
              alt={authorImage?.alt ?? author ?? ''}
              fill
              sizes="40px"
              className="object-cover"
            />
          </span>
        ) : null}
        <span className="flex flex-col">
          {author ? <span className="text-sm font-semibold text-text-headings">{author}</span> : null}
          {authorRole ? <span className="text-sm text-text-placeholders">{authorRole}</span> : null}
        </span>
      </figcaption>
    </figure>
  );
}

export const quoteEntry: CMSComponentEntry = {
  definition: {
    type: 'cms-quote',
    label: 'Quote',
    description: 'Pull-quote or testimonial with author and optional avatar.',
    fieldDefinitions: sharedFieldDefinitions,
    props: {
      quote: { label: 'Quote', type: 'textarea', required: true },
      author: { label: 'Author', type: 'text' },
      author_role: { label: 'Author role', type: 'text' },
      author_image: { $ref: 'image', label: 'Author image', type: 'media', allowedTypes: ['image/*'] },
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
          { label: 'Accent', value: 'accent' },
        ],
      },
      style: {
        label: 'Style',
        type: 'select',
        options: [
          { label: 'Plain', value: 'plain' },
          { label: 'Card', value: 'card' },
          { label: 'Bordered', value: 'bordered' },
        ],
      },
    },
    defaultProps: { alignment: 'left', tone: 'default', style: 'plain' },
  },
  mapProps: (p) => ({
    quote: p.quote,
    author: p.author,
    authorRole: p.author_role,
    authorImage: p.author_image,
    alignment: p.alignment,
    tone: p.tone,
    style: p.style,
  }),
  component: Quote,
};
