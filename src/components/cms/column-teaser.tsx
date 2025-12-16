'use client';

import Image from 'next/image';
import { H3 } from '@/components/ui/h';
import { Link } from '@/i18n/navigation';

/**
 * Column Teaser component for displaying four images in a specific layout:
 * - One large image on the left
 * - Three smaller images on the right (stacked)
 * - Responsive: on smaller screens, the three images wrap below the first one
 * - Hover effect: blue filter overlay
 */

interface ImageData {
  filename: string;
  alt?: string;
  link?: string;
  title?: string;
}

interface ColumnTeaserProps {
  main_image?: ImageData;
  side_images?: ImageData[];
}

type ImageWithHoverProps = {
  image: ImageData;
  className?: string;
};

const ImageWithHover = ({ image, className = '' }: ImageWithHoverProps) => {
  const imageElement = (
    <div className={`relative overflow-hidden group ${className}`}>
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
      <Link href={image.link} className="block h-full">
        {imageElement}
      </Link>
    );
  }

  return imageElement;
};

const ColumnTeaser = ({ main_image, side_images }: ColumnTeaserProps) => {
  // Support both Storyblok and direct props
  const mainImg = main_image;
  const sideImgs = side_images || [];

  return (
    <div className="w-full max-w-6xl mx-auto mb-10">
      <div className="grid grid-cols-2 gap-4 h-auto ">
        {/* Main image - left side */}
        {mainImg && (
          <div className="col-span-2 md:col-span-1 h-96">
            <ImageWithHover image={mainImg} className="w-full h-full" />
          </div>
        )}

        {/* Side images - right side */}
        {sideImgs.length > 0 && (
          <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
            {sideImgs.slice(0, 3).map((image, index) => (
              <div key={index} className="flex-1 h-20 md:h-auto min-h-[80px]">
                <ImageWithHover image={image} className="w-full h-full" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ColumnTeaser;
