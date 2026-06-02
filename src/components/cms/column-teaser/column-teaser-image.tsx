'use client';

import Image from 'next/image';
import { H3 } from '@/components/ui/h';
import { Link } from '@/i18n/navigation';
import { sanitizeHref } from '@/lib/sanitize-href';
import { cn } from '@/lib/utils';
import type { ColumnTeaserImageData } from './schema';

type ColumnTeaserImageProps = {
  image: ColumnTeaserImageData;
  className?: string;
};

const ColumnTeaserImage = ({ image, className = '' }: ColumnTeaserImageProps) => {
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

  if (image.link) {
    return (
      <Link href={sanitizeHref(image.link)} className="block h-full">
        {imageElement}
      </Link>
    );
  }

  return imageElement;
};

export default ColumnTeaserImage;
