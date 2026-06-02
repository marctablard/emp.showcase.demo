'use client';

import type { HTMLAttributes } from 'react';
import Image from 'next/image';
import { H2 } from '@/components/ui/h';
import { Link } from '@/i18n/navigation';
import { sanitizeHref } from '@/lib/sanitize-href';
import { cn } from '@/lib/utils';
import type { ContentBlockData } from './schema';

// Omit HTMLAttributes.style — collides with our schema's literal-union
// `style` field. Inline-style overrides on a CMS block aren't a use case
// the spread contract needs to cover.
export type ContentBlockProps = ContentBlockData & Omit<HTMLAttributes<HTMLDivElement>, 'style'>;

const CONTAINER_CLASSES = {
  'full-width': 'w-full',
  vignette: 'max-w-4xl mx-auto rounded-md shadow-lg overflow-hidden',
  teaser: 'max-w-sm rounded-md shadow-md overflow-hidden',
} as const;

const ContentBlock = ({
  id: _id,
  type: _type,
  title,
  description,
  images,
  background_image,
  button,
  style,
  className,
  ...rest
}: ContentBlockProps) => {
  const containerClasses = CONTAINER_CLASSES[style ?? 'full-width'];

  const sanitizedLink = sanitizeHref(button?.link);
  const buttonHref = sanitizedLink || '#';
  const isExternalButton = buttonHref.startsWith('http') || button?.is_external;

  return (
    <div className={cn('content-block relative', containerClasses, 'my-8', className)} {...rest}>
      {background_image?.filename && (
        <div className="absolute inset-0 z-0">
          <Image src={background_image.filename} alt={background_image.alt || ''} fill className="object-cover" />
          <div className="absolute inset-0 bg-surface-neutral bg-opacity-40"></div>
        </div>
      )}

      <div className={cn('relative z-10 p-8', background_image?.filename && 'text-text-on-action')}>
        {title && (
          <H2 variant="h6" className="mb-4">
            {title}
          </H2>
        )}

        {description && <div className="mb-6">{description}</div>}

        {images && images.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {images.map((image, index) => (
              <div key={index} className="relative h-48">
                <Image src={image.filename} alt={image.alt || ''} fill className="object-cover rounded" />
              </div>
            ))}
          </div>
        )}

        {button?.name &&
          (isExternalButton ? (
            <a
              href={buttonHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-2 bg-surface-action text-text-on-action rounded hover:bg-surface-action-hover transition-colors"
            >
              {button.name}
            </a>
          ) : (
            <Link
              href={buttonHref}
              className="inline-block px-6 py-2 bg-surface-action text-text-on-action rounded hover:bg-surface-action-hover transition-colors"
            >
              {button.name}
            </Link>
          ))}
      </div>
    </div>
  );
};

export default ContentBlock;
