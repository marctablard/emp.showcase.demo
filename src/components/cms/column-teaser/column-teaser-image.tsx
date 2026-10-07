'use client';

import Image from 'next/image';
import { H3 } from '@/components/ui/h';
import { Link } from '@/i18n/navigation';
import { isExternalHref, sanitizeHref } from '@/lib/sanitize-href';
import { cn } from '@/lib/utils';
import type { ColumnTeaserImageData } from './schema';

type ColumnTeaserImageProps = {
  image: ColumnTeaserImageData;
  className?: string;
};

const ColumnTeaserImage = ({ image, className = '' }: Readonly<ColumnTeaserImageProps>) => {
  const imageElement = (
    <div className={cn('relative overflow-hidden group', className)}>
      <Image
        src={image.filename}
        alt={image.alt || image.title || 'Image'}
        fill
        className="object-cover transition-all duration-300 group-hover:scale-105"
      />
      {/* Blue overlay on hover */}
      <div className="absolute inset-0 bg-surface-action group-hover:bg-surface-action-hover transition-all duration-300" />
      {image.title && (
        <div className="absolute bottom-4 left-4 right-4">
          <H3
            variant="h5"
            className="text-text-on-action shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            {image.title}
          </H3>
        </div>
      )}
    </div>
  );

  const href = sanitizeHref(image.link);

  // An unsafe link sanitises to '' — render the plain image rather than a link
  // that would still navigate through the i18n router.
  if (!href) {
    return imageElement;
  }

  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">
        {imageElement}
      </a>
    );
  }

  return (
    <Link href={href} className="block h-full">
      {imageElement}
    </Link>
  );
};

export default ColumnTeaserImage;
